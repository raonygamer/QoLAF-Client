import { read, type API } from '../api/Types';
import { ClientIPCService } from '../ipc/ClientIPCService';
import type { MusicPlayerService } from '../music/MusicPlayer';
import { portedClasses } from '../ported/Registry';
import { createRoomInvitePulseColor } from '../ported/RoomInvitePulseColor';
import { NativeRadioSound } from './NativeRadioSound';
import { RadioAudio } from './RadioAudio';
import { fetchRadioAudioURL } from './RadioAudioURL';
import type { RadioServiceEnvironment } from './RadioService';
import { RadioTransport, type RadioTransportPlatform } from './RadioTransport';

/** Bind radio to the same authentication, game clock, volume and music service as the client. */
export function createNativeRadioEnvironment(
  api: API,
  music: MusicPlayerService,
  createPlatform: () => RadioTransportPlatform,
): RadioServiceEnvironment {
  const resolve = portedClasses(api).resolve;
  const now = () => performance.now();
  return {
    now,
    every: (callback, interval) => api.interval(callback, interval),
    ipc: () => ClientIPCService.instance,
    game: () => {
      const game = api.game;
      return game
        ? {
            networkServerTime: Number(read(game, 'networkServerTime', NaN)),
            isLeaving: !!read(game, 'isLeaving', false),
            me: game.me ? { id: game.me.id, name: game.me.name } : undefined,
          }
        : null;
    },
    musicVolume: () => {
      const service = api.cls('sound.SoundLocator')?.getService();
      return service ? Number(read(service, 'musicVolume', NaN)) : null;
    },
    acquireMusic: (owner, leave) => music.acquireExternal(owner, leave),
    releaseMusic: (owner) => music.releaseExternal(owner),
    createTransport: () => new RadioTransport(createPlatform()),
    createAudio: () => new RadioAudio(() => new NativeRadioSound(resolve, fetchRadioAudioURL), now),
    notice: (text) => {
      const escaped = (text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const pulse = createRoomInvitePulseColor(resolve);
      api.cls('core.hud.components.chat.MessageLog')?.write(pulse.wrapRadio(escaped));
    },
  };
}
