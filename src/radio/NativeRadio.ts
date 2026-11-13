import { read, type API, type Raw } from '../api/Types';
import { ClientIPCService } from '../ipc/ClientIPCService';
import type { MusicPlayerService } from '../music/MusicPlayer';
import { portedClasses } from '../ported/Registry';
import { createBitmapClasses } from '../ui/BitmapClasses';
import { BrowserRadioPlatform } from './BrowserRadioPlatform';
import { createNativeRadioEnvironment } from './NativeRadioEnvironment';
import { createNativeRadioChatBridge } from './NativeRadioChatBridge';
import { createRadioInput } from './RadioInput';
import { RadioInvites } from './RadioInvites';
import { createRadioPopup } from './RadioPopup';
import { RadioService } from './RadioService';
import { installRadioKeyboard } from './RadioKeyboard';

/** Plugin-owned audio/room lifetime; each game session owns only its native view and commands. */
export function installNativeRadio(api: API, music: MusicPlayerService) {
  let service: RadioService | null = null;
  let inviteOwner: ClientIPCService | null = null;
  let invites: RadioInvites | null = null;
  const environment = createNativeRadioEnvironment(api, music, () => {
    let platform: BrowserRadioPlatform | null = null;
    return {
      toolsDirectory: '',
      now: () => performance.now(),
      open: (output, exited, failed) => {
        platform = new BrowserRadioPlatform(api.storage.get('radio.bridge', ''));
        return platform.open(output, exited, failed);
      },
      validatePreparedFile: (path) => {
        if (!platform) throw Error('Radio bridge is disconnected.');
        return platform.validatePreparedFile(path);
      },
    };
  });
  const getService = () => (service ??= new RadioService(environment));
  const syncInvites = () => {
    const current = ClientIPCService.instance;
    if (current === inviteOwner) return;
    invites?.dispose();
    inviteOwner = current;
    invites = current
      ? new RadioInvites(current, {
          now: environment.now,
          clock: () => {
            const game = environment.game();
            return game && !game.isLeaving ? game.networkServerTime : NaN;
          },
          after: (callback, ms) => {
            const timer = setTimeout(callback, ms);
            return () => clearTimeout(timer);
          },
          currentTransport: () => ClientIPCService.instance,
          existingRadio: () => service,
          getRadio: getService,
          currentGame: () => api.game,
          inCurrentRoom: (game, id) => {
            if (!game || game !== api.game) return false;
            const players = (game as Raw).playerManager?.playersById;
            return !!(players?.h?.[id] ?? players?.[id]);
          },
          note: environment.notice,
        })
      : null;
  };
  syncInvites();
  api.interval(syncInvites, 250);
  api.defer(() => {
    invites?.dispose();
    service?.dispose();
    invites = null;
    service = null;
  });

  return {
    installSession(game: Raw, session: API): void {
      const chat = game.chatInput;
      if (!chat) return;
      const bridge = createNativeRadioChatBridge(session, document);
      let Popup: ReturnType<typeof createRadioPopup> | undefined;
      const open = () => {
        if (read(game, 'isLeaving', false)) return;
        const resolve = createBitmapClasses(portedClasses(session).resolve).resolve;
        Popup ??= createRadioPopup(
          resolve,
          createRadioInput(resolve),
          getService(),
          bridge,
          createRadioInput(resolve, true),
        );
        Popup.open(game);
      };
      session
        .cls('af.ChatCommandRegistry')
        ?.reserveBuiltInCommands(['radio', 'invitetoradio', 'radioinvite', 'radiobridge']);
      if (typeof chat.listCommands === 'function') {
        session.after(chat, 'listCommands', () => {
          const log = session.cls('core.hud.components.chat.MessageLog');
          log?.write("''/radio'' opens Radio groups and shared playback");
          log?.write("''/invitetoradio <@Player|roompeers|allpeers|[@a,@b]>'' invites IPC peers");
          log?.write("''/radioinvite <accept|deny>'' responds to a Radio invitation");
          log?.write(
            "''/radiobridge <connection address>'' uses the address printed by the local Radio helper bridge",
          );
        });
      }
      session.around(chat, 'sendMessage', function (next, ...args) {
        const text = read(this.input, 'text', '');
        if (!text.startsWith('/')) return next(...args);
        const [name, argument = ''] = this.parseCommand(text);
        if (!['radio', 'invitetoradio', 'radioinvite', 'radiobridge'].includes(name))
          return next(...args);
        // Clear before opening a native window or replacing the transport.
        this.input.set_text('');
        this.updateTab();
        if (name === 'radio') open();
        else if (name === 'radiobridge') {
          try {
            const endpoint = argument.trim();
            new BrowserRadioPlatform(endpoint); // Validate without contacting the helper.
            api.storage.set('radio.bridge', endpoint);
            service?.retry();
            environment.notice('Radio bridge address saved. Open /radio to connect.');
          } catch {
            environment.notice(
              'Usage: /radiobridge <connection address printed by the local Radio bridge>',
            );
          }
        } else {
          syncInvites();
          if (!invites) environment.notice('Wait until IPC is connected.');
          else if (name === 'invitetoradio') invites.invite(argument);
          else invites.respond(argument);
        }
      });
      const previous = Object.getOwnPropertyDescriptor(chat, 'openRadio');
      chat.openRadio = open;
      session.defer(installRadioKeyboard(window, game, bridge, () => Popup?.active));
      const preserveModal = () => {
        if (bridge.hasPopup(game)) game.blockHotkeys = true;
      };
      session.after(game, 'addChildToOverlay', preserveModal);
      session.after(game, 'removeChildFromOverlay', preserveModal);
      session.defer(() => {
        Popup?.active?.dismiss();
        if (chat.openRadio !== open) return;
        if (previous) Object.defineProperty(chat, 'openRadio', previous);
        else delete chat.openRadio;
      });
    },
  };
}
