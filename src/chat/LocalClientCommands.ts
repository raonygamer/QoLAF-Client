import { createClientLog } from '../diagnostics/ClientLog';
import { installServerEndpoints } from '../network/ServerEndpoints';
import { invalidateChatView } from './ChatViewInvalidation';
import { localCommandHelp } from './LocalCommandHelp';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { runChatSpeedTest } from './ChatSpeedTest';
import { commandTorpedoDebug } from '../projectile/NativeTorpedoDebug';
import { commandTorpedoTiming } from '../projectile/NativeTorpedoTiming';
import { disconnectRoomForRecovery } from '../network/DisconnectDiagnostic';
import { GameReflection } from '../api/GameReflection';
import { roomDiagnostics } from './RoomDiagnosticsCommand';
import { switchInstance } from './SwitchInstanceCommand';
import { warpToSystem } from './WarpCommand';
import { createFriendWarp } from './FriendWarpCommand';
import { requestServiceSwitch } from '../service/ServiceSwitch';
import { respondToRoomInvite, sendRoomControl } from './NativeRoomControl';
import { createClockResync } from '../clock/NativeClockResync';
import { read, type API, type Raw } from '../api/Types';
import { clientEchoText, runClientEcho } from './ClientEcho';
import type { CommandHelpEntry } from './ChatCommandRegistry';
import { ChatPlayerCommandNormalizer } from './ChatPlayerCommandNormalizer';

export const localClientCommandNames = [
  'log',
  'discordpresence',
  'warp',
  'privatewarp',
  'warptofriend',
  'listrooms',
  'listsystems',
  'resync',
  'disconnect',
  'qipc3dbg',
  'switchinstance',
  'switchservice',
  'joinservice',
  'roominvite',
  'invitetoroom',
  'kickfromroom',
  'aimdebug',
  'aimassistdebug',
  'upstream',
  'restart',
  'timers',
  'torptiming',
  'torpdbg',
  'testchatspeed',
  'clearchat',
  'echo',
  'spececho',
  'ref',
  'refresh',
  'tptodeath',
  'y',
  'yes',
] as const;

export function escapeCommandText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Same display aliases and escaping as the original listCustomCommands. */
export function customCommandHelp(entries: CommandHelpEntry[]): string[] {
  if (!entries.length) return [];
  return [
    "''Custom commands''",
    ...entries.map((entry) => {
      const name = entry.ownsBareName
        ? entry.fullName.slice(entry.fullName.indexOf(':') + 1)
        : entry.fullName;
      const qualified = entry.ownsBareName ? ` (also /${escapeCommandText(entry.fullName)})` : '';
      return `''/${escapeCommandText(name)}${escapeCommandText(entry.usage)}''${qualified} - ${escapeCommandText(entry.description)}`;
    }),
  ];
}

/** Clear both projections and the shared received queue, preserving sent history/settings. */
export function clearLocalChat(game: Raw, log: Raw): void {
  const view = game.messageLog;
  if (!view) return;
  if (typeof view.clearMessages === 'function') {
    view.clearMessages();
    return;
  }
  if (Array.isArray(log.textQueue)) log.textQueue.length = 0;
  view.nextTimeout = 0;
  const simple = view.simple;
  if (simple) {
    if (typeof simple.clearMessages === 'function') simple.clearMessages();
    else {
      invalidateChatView(simple);
      simple.nextTimeout = 0;
      simple.tf.set_text('');
      simple.tf.set_y(0);
    }
  }
  const advanced = view.advanced;
  if (advanced) {
    if (typeof advanced.clearMessages === 'function') advanced.clearMessages();
    else {
      invalidateChatView(advanced);
      // Current Haxe ChatAdvanced owns rows directly in its ScrollBox. Its
      // delayed callbacks only scroll; none retain rows to enqueue again.
      advanced.scroll.removeChildren(0, -1, true);
      advanced.scroll.scrollToPosition(0, 0);
      advanced.playerChatOptions?.removeFromParent(true);
      advanced.playerChatOptions = null;
    }
  }
}

export function installLocalClientCommands(api: API): void {
  const chat = api.cls('core.hud.components.chat.ChatInputText')?.prototype;
  if (!chat) return;
  api.around(chat, 'parseCommand', function (next, ...args) {
    const command: string[] = next(...args);
    // ssv owns its target parser. Room/radio/custom commands are outside the
    // normalizer's allowlist, so their argument grammar remains untouched.
    if (command.length !== 2 || command[0] === 'ssv') return command;
    return [command[0], ChatPlayerCommandNormalizer.normalizeArguments(command[0], command[1])];
  });
  const serverEndpoint =
    typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__
      ? installServerEndpoints(api)
      : null;
  const openLog = createClientLog(api);
  const resync = createClockResync(api);
  const warpToFriend =
    typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__ ? createFriendWarp(api) : null;
  const log = api.cls('core.hud.components.chat.MessageLog')!;
  const registry = api.cls('af.ChatCommandRegistry');
  registry?.reserveBuiltInCommands(localClientCommandNames);
  if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
    registry?.reserveBuiltInCommands(['serverip']);
  api.around(chat, 'sendMessage', function (next, ...args) {
    const text: string = this.input.get_text();
    if (!text.startsWith('/')) return next(...args);
    const [name, argument = ''] = this.parseCommand(text);
    if (
      !(typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__) &&
      [
        'warp',
        'privatewarp',
        'warptofriend',
        'listrooms',
        'listsystems',
        'inspect',
        'switchservice',
        'joinservice',
        'invitetoroom',
        'kickfromroom',
        'serverip',
      ].includes(name)
    ) {
      log.write("You're not allowed to do that.", 'error');
    } else if (
      !(typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__) &&
      (name === 'script' || name === 'automation')
    ) {
      log.write('Unavailable by moderation requests.', 'error');
    } else if (name === 'invitetoroom' || name === 'kickfromroom') {
      this.input.set_text('');
      if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
        sendRoomControl(
          new GameReflection(api).cast(this.g, 'core.scene.Game'),
          argument,
          name === 'kickfromroom',
        );
      return;
    } else if (name === 'serverip') {
      if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__) {
        const game = new GameReflection(api).cast(this.g, 'core.scene.Game');
        log.write('Service IP: ' + (serverEndpoint?.(game.serviceConnection) ?? 'unavailable'));
        log.write('Game IP: ' + (serverEndpoint?.(game.connection) ?? 'unavailable'));
      }
    } else if (name === 'log') {
      openLog(new GameReflection(api).cast(this.g, 'core.scene.Game'));
    } else if (name === 'roominvite') {
      this.input.set_text('');
      respondToRoomInvite(new GameReflection(api).cast(this.g, 'core.scene.Game'), argument);
      return;
    } else if (name === 'switchservice' || name === 'joinservice') {
      this.input.set_text('');
      if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
        requestServiceSwitch(
          new GameReflection(api).cast(this.g, 'core.scene.Game'),
          argument,
          name === 'joinservice',
        );
      return;
    } else if (name === 'warptofriend') {
      this.input.set_text('');
      if (warpToFriend)
        warpToFriend(new GameReflection(api).cast(this.g, 'core.scene.Game'), argument);
      return;
    } else if (name === 'warp' || name === 'privatewarp') {
      this.input.set_text('');
      if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
        warpToSystem(api, this.g, argument, name === 'privatewarp');
      return;
    } else if (name === 'listrooms' || name === 'listsystems') {
      if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
        roomDiagnostics(api, this.g, name, argument);
    } else if (name === 'switchinstance') {
      this.input.set_text('');
      switchInstance(api, this.g, argument);
      return;
    } else if (name === 'restart') {
      // Reload the launcher as well as the game frame so its update/plugin
      // loading path runs again. Clear input before the page can be disposed.
      this.input.set_text('');
      log.write('Reloading QoLAF through the launcher...');
      try {
        (window.top ?? window).location.reload();
      } catch {
        log.write('The launcher could not be reloaded. Reload the QoLAF page.', 'error');
      }
      return;
    } else if (name === 'spececho') {
      runClientEcho(api, new GameReflection(api).cast(this.g, 'core.scene.Game'));
    } else if (name === 'aimdebug' || name === 'aimassistdebug') {
      const play = api.cls('core.states.gameStates.PlayState');
      const settings = api.cls('core.scene.SceneBase')?.clientSettings;
      let enabled: boolean;
      if (typeof play?.toggleAimAssistDebug === 'function') enabled = play.toggleAimAssistDebug();
      else if (settings) {
        enabled = !settings.getAimAssistBoolean('aim_assist_debug');
        settings.setAimAssistBoolean('aim_assist_debug', enabled);
      } else {
        log.write('Aim-assist settings are not available yet.', 'error');
        this.input.set_text('');
        this.updateTab();
        return;
      }
      const machine = this.g?.gameStateMachine;
      const state = read(machine, 'activeState', machine?.currentState);
      state?.applyAimAssistDebugVisibility?.();
      log.write('Aim-assist debug overlay ' + (enabled ? 'enabled.' : 'disabled.'));
    } else if (name === 'disconnect') {
      const game = new GameReflection(api).cast(this.g, 'core.scene.Game');
      // Recovery can synchronously dispose chat; clear before closing the socket.
      this.input.set_text('');
      disconnectRoomForRecovery(game, argument);
      return;
    } else if (name === 'qipc3dbg') {
      const ipc = ClientIPCService.instance;
      if (!ipc) log.write('QIPC3 debug unavailable: IPC is not initialized.', 'error');
      else log.write(`QIPC3 debug ${ipc.toggleDebug() ? 'enabled.' : 'disabled.'}`, 'debug');
    } else if (name === 'resync') {
      resync(new GameReflection(api).cast(this.g, 'core.scene.Game'), argument);
    } else if (name === 'ref' || name === 'refresh' || name === 'upstream') {
      // Clear before reload: the native method can synchronously dispose chat.
      this.input.set_text('');
      this.g.reload();
      return;
    } else if (name === 'tptodeath') {
      // Preserve the original explicit command's server-authoritative request.
      // Haxe rpc receives its argument list as an array rather than AS3 rest args.
      this.g.rpc('buyTeleportToDeath', () => {}, [read(this.g, 'me').id]);
    } else if (name === 'y' || name === 'yes') {
      this.sendConfirmInviteGroup();
    } else if (name === 'testchatspeed') {
      runChatSpeedTest();
    } else if (name === 'torpdbg') {
      commandTorpedoDebug(api, this.g, argument);
    } else if (name === 'torptiming') {
      commandTorpedoTiming(api, this.g, argument);
    } else if (name === 'timers') {
      const settings = api.cls('core.scene.SceneBase')?.clientSettings;
      if (argument.trim()) log.write('Usage: /timers', 'error');
      else if (!settings) log.write('Timer settings are not available yet.', 'error');
      else {
        settings.showSecondaryBossTimers = !settings.showSecondaryBossTimers;
        log.write(
          `Secondary boss timers ${settings.showSecondaryBossTimers ? 'enabled.' : 'disabled.'}`,
        );
      }
    } else if (name === 'clearchat') clearLocalChat(this.g, log);
    else if (name === 'echo') {
      // Original public client release convention.
      log.writeChatMsg('death', `Your client is: ${clientEchoText()}`);
    } else return next(...args);
    this.input.set_text('');
    this.updateTab();
  });
  if (typeof chat.listCommands !== 'function') return;
  api.after(chat, 'listCommands', function () {
    for (const line of localCommandHelp()) log.write(line);
    for (const line of customCommandHelp(registry?.getHelpEntries() ?? [])) log.write(line);
  });
}
