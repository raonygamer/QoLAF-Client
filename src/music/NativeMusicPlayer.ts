import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { installPopupKeyboard } from '../dialogs/NativePopupKeyboard';
import { createMusicPlayer, type MusicPlayerService } from './MusicPlayer';
import { createMusicPlayerPopup } from './MusicPlayerPopup';
import { installNativeSoundChannels } from './NativeSoundChannels';
import { installNativeMusicPlayback } from './NativeMusicPlayback';

export function installMusicService(api: API): MusicPlayerService {
  const player = createMusicPlayer(portedClasses(api).resolve);
  installNativeSoundChannels(api);
  installNativeMusicPlayback(api, player);
  return player;
}

export function installNativeMusicPlayer(api: API, game: Raw, player: MusicPlayerService): void {
  player.restoreForAccount(game.me?.id);
  const chat = game.chatInput;
  if (!chat) return;
  let Popup: ReturnType<typeof createMusicPlayerPopup> | undefined;
  const open = () => {
    Popup ??= createMusicPlayerPopup(portedClasses(api).resolve, player);
    Popup.open(game);
  };
  const close = () => Popup?.active?.dismiss();
  const original = Object.getOwnPropertyDescriptor(chat, 'openMusicPlayer');
  chat.openMusicPlayer = open;
  api.around(chat, 'sendMessage', (next, ...args) => {
    const text = read(chat.input, 'text', '');
    if (!text.startsWith('/') || chat.parseCommand(text)[0] !== 'music') return next(...args);
    open();
    chat.input.set_text('');
    chat.updateTab();
  });
  const registry = api.cls('af.ChatCommandRegistry');
  registry?.reserveBuiltInCommands(['music']);
  api.defer(installPopupKeyboard(window, () => !!Popup?.active, close));
  api.defer(() => {
    close();
    if (original) Object.defineProperty(chat, 'openMusicPlayer', original);
    else delete chat.openMusicPlayer;
  });
}
