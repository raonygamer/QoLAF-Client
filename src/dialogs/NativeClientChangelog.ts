import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { createClientChangelogPopup } from './ClientChangelogPopup';
import { installPopupKeyboard } from './NativePopupKeyboard';
import { ClientReleaseSequence } from './ClientReleaseSequence';
import { PORT_VERSION } from '../login/LoginIdentity';

const releases = new ClientReleaseSequence();

export function installNativeClientChangelog(api: API, game: Raw): () => boolean {
  const chat = game.chatInput;
  if (!chat) return () => false;
  const Popup = createClientChangelogPopup(portedClasses(api).resolve);
  let popup: Raw | null = null;
  const close = () => {
    const previous = popup;
    popup = null;
    if (!previous) return;
    previous.removeEventListener('close', close);
    if (read(previous, 'parent')) {
      const recovering = game.isRecoveringGameConnection;
      game.removeChildFromOverlay(previous, true);
      if (recovering) game.blockHotkeys = true;
    } else previous.dispose();
  };
  const open = releases.install(api, game, PORT_VERSION, () => {
    if (api.game !== game || game.isLeaving || game.isRecoveringGameConnection) return false;
    if (popup) return true;
    popup = new Popup();
    popup!.addEventListener('close', close);
    game.addChildToOverlay(popup, true);
    return true;
  });
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
      api
        .cls('core.hud.components.chat.MessageLog')
        ?.write("''/changelog'' opens the original client release history");
    });
  }
  api.defer(() => {
    close();
    if (original) Object.defineProperty(chat, 'openClientChangelog', original);
    else delete chat.openClientChangelog;
  });
  return () => popup !== null || !releases.hasSeen(api, PORT_VERSION);
}
