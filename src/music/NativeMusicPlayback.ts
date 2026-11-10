import { read, type API, type Raw } from '../api/Types';
import type { MusicPlayerService } from './MusicPlayer';

interface PlaybackRequest {
  revision: number;
  key: string | null;
  timer?: ReturnType<typeof setTimeout>;
  clearCompletion?: () => void;
}

/** Preserve the source manager's cancellation checks before asynchronous audio starts. */
export function installNativeMusicPlayback(api: API, player: MusicPlayerService): void {
  const manager = api.cls('sound.SoundManager')!.prototype;
  const locator = api.cls('sound.SoundLocator')!;
  const tween = api.cls('com.greensock.TweenMax');
  const states = new Map<Raw, PlaybackRequest>();
  const stateFor = (service: Raw) => {
    let state = states.get(service);
    if (!state) states.set(service, (state = { revision: 0, key: null }));
    return state;
  };
  const cancel = (service: Raw) => {
    const state = stateFor(service);
    ++state.revision;
    clearTimeout(state.timer);
    state.timer = undefined;
    state.clearCompletion?.();
    state.clearCompletion = undefined;
    state.key = null;
  };
  const musicObjects = (service: Raw): Raw[] => Object.values(service.musicObjects.h);
  const pause = (object: Raw) => {
    tween?.killTweensOf(object);
    object.pause();
  };
  const pauseOthers = (service: Raw, key: string, fade: boolean) => {
    for (const object of musicObjects(service)) {
      if (object.key === key) continue;
      tween?.killTweensOf(object);
      if (fade && object.isPlaying) object.fadeStop();
      else object.pause();
    }
  };
  const play = (
    service: Raw,
    key: string,
    loop: boolean,
    resume: boolean,
    onLoad?: (channel: Raw | null) => void,
    onComplete?: () => void,
    fade = false,
  ) => {
    cancel(service);
    const state = stateFor(service);
    state.key = key;
    const revision = state.revision;
    const current = () =>
      state.revision === revision && state.key === key && locator.getService() === service;
    const fading = fade && musicObjects(service).some((o) => o.key !== key && o.isPlaying);
    pauseOthers(service, key, fading);
    const begin = () => {
      state.timer = undefined;
      if (!current()) return;
      if (read(service, 'musicVolume', 0) < 0.1 && !onLoad && !onComplete) return;
      // Native getSoundObject silently drops unknown keys; report that case to the player.
      if (!api.cls('data.DataLocator')!.getService()?.loadKey('Sounds', key)) {
        onLoad?.(null);
        return;
      }
      service.getSoundObject(
        key,
        (object: Raw) => {
          if (!current()) return;
          service.musicObjects.h[key] = object;
          delete service.effectObjects.h[key];
          object.multipleAllowed = false;
          pauseOthers(service, key, false);
          tween?.killTweensOf(object);
          const volume = read(object, 'originalVolume', 1) * read(service, 'musicVolume', 0);
          const channel = resume ? object.resume(volume, loop) : object.playObject(volume, loop);
          if (channel && onComplete) {
            const complete = () => {
              channel.removeEventListener('soundComplete', complete);
              state.clearCompletion = undefined;
              if (current()) onComplete();
            };
            state.clearCompletion = () => channel.removeEventListener('soundComplete', complete);
            channel.addEventListener('soundComplete', complete);
          }
          // Register completion first: a load callback may immediately stop or replace playback.
          onLoad?.(channel);
        },
        'music',
      );
    };
    if (fading) state.timer = setTimeout(begin, 3000);
    else begin();
  };
  api.around(
    manager,
    'playMusic',
    function (_next, key, loop = false, resume = false, onLoad, onComplete, fade = false) {
      if (!player.allowPlay(this, key, loop, resume, onLoad, onComplete, fade)) return;
      play(this, key, loop, resume, onLoad, onComplete, fade);
    },
  );
  api.around(manager, 'internalPlay', function (next, type, key, loop, resume, onLoad, onComplete) {
    if (type !== 'music') return next(type, key, loop, resume, onLoad, onComplete);
    if (!player.blocksMusic(this)) play(this, key, loop, resume, onLoad, onComplete);
  });
  api.around(manager, 'stopMusic', function () {
    if (!player.allowStop(this)) return;
    cancel(this);
    for (const object of musicObjects(this)) pause(object);
  });
  api.around(manager, 'stop', function (_next, key, callback) {
    if (player.protectsTrack(this, key)) return;
    if (stateFor(this).key === key) cancel(this);
    // Stopping an uncached track must not initiate a network audio load.
    const object = this.soundObjects.h[key];
    if (object) {
      tween?.killTweensOf(object);
      object.stop();
    }
    callback?.();
  });
  api.around(manager, 'stopAllMusicExcept', function (_next, key, fade = true) {
    if (player.blocksMusic(this)) return;
    if (stateFor(this).key !== key) cancel(this);
    pauseOthers(this, key, fade);
  });
  api.before(manager, 'stopAll', function () {
    cancel(this);
    for (const object of musicObjects(this)) pause(object);
    player.onServiceStopped(this);
  });
  api.before(locator, 'register', function (service) {
    const previous = locator.getService();
    if (!previous || previous === service) return;
    cancel(previous);
    for (const object of musicObjects(previous)) pause(object);
    player.onServiceStopped(previous);
  });
  api.defer(() => {
    for (const service of states.keys()) {
      cancel(service);
      player.onServiceStopped(service);
    }
    states.clear();
  });
}
