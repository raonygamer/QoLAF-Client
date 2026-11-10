import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { createClientChangelogPopup } from './ClientChangelogPopup';
import { installPopupKeyboard } from './NativePopupKeyboard';

export function installNativeClientChangelog(api: API, game: Raw): void {
  const chat = game.chatInput;
  if (!chat) return;
  const Popup = createClientChangelogPopup(portedClasses(api).resolve);
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
    popup = new Popup();
    popup!.addEventListener('close', close);
    game.addChildToOverlay(popup, true);
  };
  const original = Object.getOwnPropertyDescriptor(chat, 'openClientChangelog');
  chat.openClientChangelog = open;
  api.defer(installPopupKeyboard(window, () => popup !== null, close));
  api.around(chat, 'sendMessage', (next, ...args) => {
    const value = chat.input.get_text();
    if (!value.startsWith('/') || chat.parseCommand(value)[0] !== 'changelog') return next(...args);
    open();
    chat.input.set_text('');
    chat.updateTab();
  });
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(['changelog']);
  if (typeof chat.listCommands === 'function') {
    api.after(chat, 'listCommands', () => {
      api.cls('core.hud.components.chat.MessageLog')?.write(
        "''/changelog'' opens the original client release history",
      );
    });
  }
  api.defer(() => {
    close();
    if (original) Object.defineProperty(chat, 'openClientChangelog', original);
    else delete chat.openClientChangelog;
  });
}
