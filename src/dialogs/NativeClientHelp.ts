import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { ClientHelpContent } from './ClientHelpContent';
import { createClientHelpPopup } from './ClientHelpPopup';
import { installNativeClientWelcome } from './NativeClientWelcome';
import { installPopupKeyboard } from './NativePopupKeyboard';

export function installNativeClientHelp(api: API, game: Raw): void {
  const chat = game.chatInput;
  if (!chat) return;
  const resolve = portedClasses(api).resolve;
  const Popup = createClientHelpPopup(resolve);
  const registry = api.cls('af.ChatCommandRegistry');
  let popup: Raw | null = null;
  const close = () => {
    const previous = popup;
    popup = null;
    if (!previous) return;
    previous.removeEventListener('close', close);
    if (read(previous, 'parent')) game.removeChildFromOverlay(previous, true);
    else previous.dispose();
  };
  const open = () => {
    if (popup || read(game, 'isLeaving', false)) return;
    dismissWelcome();
    const serviceRoom = api.cls('joinRoom.JoinRoomManager')?.getServiceRoomID(0) ?? '';
    const serverVersion = /^Service-(\d+)_/.exec(serviceRoom)?.[1] ?? 'unknown';
    const pages = new ClientHelpContent(
      serverVersion,
      !!game.automationManager,
      registry?.getHelpEntries() ?? [],
    ).createPages();
    popup = new Popup(pages);
    popup!.addEventListener('close', close);
    game.addChildToOverlay(popup, true);
  };
  const dismissWelcome = installNativeClientWelcome(api, game, resolve, open);
  const original = Object.getOwnPropertyDescriptor(chat, 'openClientHelp');
  chat.openClientHelp = open;
  api.defer(installPopupKeyboard(window, () => popup !== null, close));
  api.around(chat, 'sendMessage', (next, ...args) => {
    const value = chat.input.get_text();
    const command = value.startsWith('/') ? chat.parseCommand(value)[0] : '';
    if (command !== 'chelp' && command !== 'clienthelp') return next(...args);
    open();
    chat.input.set_text('');
    chat.updateTab();
  });
  registry?.reserveBuiltInCommands(['chelp', 'clienthelp']);
  if (typeof chat.listCommands === 'function') {
    api.after(chat, 'listCommands', () => {
      api
        .cls('core.hud.components.chat.MessageLog')
        ?.write("''/chelp'' or ''/clienthelp'' opens the tabbed client guide");
    });
  }
  api.defer(() => {
    close();
    if (original) Object.defineProperty(chat, 'openClientHelp', original);
    else delete chat.openClientHelp;
  });
}
