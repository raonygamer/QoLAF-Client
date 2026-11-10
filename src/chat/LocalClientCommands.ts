import type { API, Raw } from '../api/Types';
import { CLIENT_VERSION } from '../login/LoginIdentity';
import type { CommandHelpEntry } from './ChatCommandRegistry';

export const localClientCommandNames = ['timers', 'clearchat', 'echo'] as const;

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
      simple.nextTimeout = 0;
      simple.tf.set_text('');
      simple.tf.set_y(0);
    }
  }
  const advanced = view.advanced;
  if (advanced) {
    if (typeof advanced.clearMessages === 'function') advanced.clearMessages();
    else {
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
  const log = api.cls('core.hud.components.chat.MessageLog')!;
  const registry = api.cls('af.ChatCommandRegistry');
  registry?.reserveBuiltInCommands(localClientCommandNames);
  api.around(chat, 'sendMessage', function (next, ...args) {
    const text: string = this.input.get_text();
    if (!text.startsWith('/')) return next(...args);
    const [name, argument = ''] = this.parseCommand(text);
    if (name === 'timers') {
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
      log.writeChatMsg(
        'death',
        `Your client is: <font color='#9B5CFF'>QoLAF v${CLIENT_VERSION} (Public)</font>`,
      );
    } else return next(...args);
    this.input.set_text('');
    this.updateTab();
  });
  if (typeof chat.listCommands !== 'function') return;
  api.after(chat, 'listCommands', function () {
    log.write("''/echo'' shows the client version");
    log.write(
      "''/clearchat'' clears both chat views locally; sent-message history and settings are kept",
    );
    log.write(
      "''/timers'' toggles secondary boss timers on the radar; primary bosses and Admiral Zhersis remain visible",
    );
    for (const line of customCommandHelp(registry?.getHelpEntries() ?? [])) log.write(line);
  });
}
