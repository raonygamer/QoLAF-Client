import type { API } from '../api/Types';
import { installNativeSoundCache } from './NativeSoundCache';
import {
  IntroState,
  SoundManager,
  SoundLocator,
  DataLocator,
  TweenMax,
  type SoundObject,
  type SoundChannel,
} from '../game/Bindings';
import { SoundRequestGuard } from './SoundRequestGuard';
import type { MusicPlayerService } from './MusicPlayer';

interface PlaybackRequest {
  revision: number;
  key: string | null;
  timer?: ReturnType<typeof setTimeout>;
  clearCompletion?: () => void;
}

/** Preserve the source manager's cancellation checks before asynchronous audio starts. */
export function installNativeMusicPlayback(api: API, player: MusicPlayerService): void {
  const manager = SoundManager.prototype;
  const locator = SoundLocator;
  const tween = TweenMax;
  const states = new Map<SoundManager, PlaybackRequest>();
  const effects = new SoundRequestGuard();
  let enteringIntro = false;
  let introCleanup: object | undefined;
  api.around(IntroState.prototype, 'enter', function (next, ...args) {
    const previous = enteringIntro;
    enteringIntro = true;
    try {
      return next(...args);
    } finally {
      enteringIntro = previous;
    }
  });
  api.around(manager, 'preCacheSound', function (next, key, callback, type) {
    const precache = (complete: (() => void) | undefined) => {
      this.getSoundObject(
        key,
        (sound) => {
          if (sound) complete?.();
        },
        type ?? 'effect',
      );
    };
    if (!enteringIntro || typeof callback !== 'function') return precache(callback);
    const service = this;
    return precache(() => {
      const previous = introCleanup;
      introCleanup = service;
      try {
        callback();
      } finally {
        introCleanup = previous;
      }
    });
  });
  let effectLoad:
    | { service: object; key: string; current: () => boolean; failed: () => void }
    | undefined;
  api.defer(() => effects.dispose());
  // Only the load callback owned by native internalPlay gets a playback guard.
  // Precache consumers still receive the downloaded sound for future playback.
  api.around(manager, 'getSoundObject', function (next, key, ready, type) {
    const request = effectLoad;
    if (!request || request.service !== this || request.key !== key) return next(key, ready, type);
    // Consume this scope before native code can invoke a cached callback
    // synchronously; nested precache requests have independent ownership.
    effectLoad = undefined;
    try {
      return next(
        key,
        (sound) => {
          if (request.current()) {
            if (sound == null) request.failed();
            else ready(sound);
          }
        },
        type,
      );
    } finally {
      effectLoad = request;
    }
  });
  // The host runs earlier around-hooks first. The playback guard must wrap
  // cache misses too, since native internalPlay cannot accept a null sound.
  installNativeSoundCache(api);
  const stateFor = (service: SoundManager) => {
    let state = states.get(service);
    if (!state) states.set(service, (state = { revision: 0, key: null }));
    return state;
  };
  const cancel = (service: SoundManager) => {
    const state = stateFor(service);
    ++state.revision;
    clearTimeout(state.timer);
    state.timer = undefined;
    state.clearCompletion?.();
    state.clearCompletion = undefined;
    state.key = null;
  };
  const musicObjects = (service: SoundManager): SoundObject[] =>
    Object.values(service.musicObjects.h);
  const pause = (object: SoundObject) => {
    tween?.killTweensOf(object);
    object.pause();
  };
  const pauseOthers = (service: SoundManager, key: string, fade: boolean) => {
    for (const object of musicObjects(service)) {
      if (object.key === key) continue;
      tween?.killTweensOf(object);
      if (fade && object.isPlaying) object.fadeStop();
      else object.pause();
    }
  };
  const play = (
    service: SoundManager,
    key: string,
    loop: boolean,
    resume: boolean,
    onLoad?: (channel: SoundChannel | null) => void,
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
      if (service.get_musicVolume() < 0.1 && !onLoad && !onComplete) return;
      // Native getSoundObject silently drops unknown keys; report that case to the player.
      if (!DataLocator.getService()?.loadKey('Sounds', key)) {
        onLoad?.(null);
        return;
      }
      service.getSoundObject(
        key,
        (object: SoundObject | null) => {
          if (!current()) return;
          if (!object) {
            onLoad?.(null);
            return;
          }
          // A prior effects/precache load may own live channels on this object.
          // Stop those before promoting it to exclusive music playback.
          if (object.multipleAllowed) object.stop();
          object.key = key;
          service.musicObjects.h[key] = object;
          delete service.effectObjects.h[key];
          object.multipleAllowed = false;
          pauseOthers(service, key, false);
          tween?.killTweensOf(object);
          const volume = object.get_originalVolume() * service.get_musicVolume();
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
    if (type !== 'music') {
      const current = effects.capture(this, key);
      const previous = effectLoad;
      effectLoad = { service: this, key, current, failed: () => onLoad?.(null) };
      try {
        return next(
          type,
          key,
          loop,
          resume,
          onLoad,
          onComplete
            ? () => {
                if (current()) onComplete();
              }
            : onComplete,
        );
      } finally {
        effectLoad = previous;
      }
    }
    if (!player.blocksMusic(this)) play(this, key, loop, resume, onLoad, onComplete);
  });
  api.around(manager, 'set_musicVolume', function (_next, volume: number) {
    this._musicVolume = volume;
    const activeKey = stateFor(this).key;
    for (const object of musicObjects(this)) {
      // Retire outgoing fades before applying the user's new volume. Native
      // setters also select the world playlist, replacing death/intro music.
      tween?.killTweensOf(object);
      if (object.key !== activeKey) object.pause();
      object.set_volume(object.get_originalVolume() * volume);
    }
    return volume;
  });
  api.around(manager, 'stopMusic', function () {
    if (!player.allowStop(this)) return;
    cancel(this);
    for (const object of musicObjects(this)) pause(object);
  });
  api.around(manager, 'stop', function (_next, key, callback) {
    if (player.protectsTrack(this, key)) {
      callback?.();
      return;
    }
    effects.cancelKey(this, key);
    if (stateFor(this).key === key) {
      player.allowStop(this);
      cancel(this);
    }
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
  api.around(manager, 'stopAll', function (next) {
    effects.cancelService(this);
    if (introCleanup === this) {
      // Original IntroState uses stopEffects + stopMusic, preserving manual music.
      for (const key of Object.keys(this.effectObjects.h)) this.effectObjects.h[key].stop();
      this.stopMusic();
      return;
    }
    for (const key of Object.keys(this.soundObjects.h)) this.soundObjects.h[key].stop();
    cancel(this);
    for (const object of musicObjects(this)) pause(object);
    player.onServiceStopped(this);
    return next();
  });
  api.before(locator, 'register', function (service) {
    const previous = locator.getService();
    if (!previous || previous === service) return;
    effects.cancelService(previous);
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
