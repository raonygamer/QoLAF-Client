import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { DataLocator, SoundManager, SoundObject } from '../game/Bindings';

/** Complete failed downloads and release their queue before consumers retry. */
export function installNativeSoundCache(api: API): void {
  const reflection = new GameReflection(api);
  const pending = new Set<() => void>();
  let disposed = false;
  api.defer(() => {
    disposed = true;
    for (const cancel of [...pending]) cancel();
  });
  reflection.around(SoundManager.prototype, 'getSoundObject', function (next, key, ready, type) {
    // Cached entries remain usable even after their metadata has been removed.
    if (
      key === null ||
      (!Object.hasOwn(this.soundObjects.h, key) &&
        DataLocator.getService().loadKey('Sounds', key) == null)
    ) {
      ready(null);
      return;
    }
    return next(key, ready, type);
  });
  reflection.around(SoundManager.prototype, 'loadSoundFromUrl', function (_next, url, ready) {
    const sound = new SoundObject(url);
    let settled = false;
    const detach = () => {
      sound.removeEventListener('complete', complete);
      sound.removeEventListener('ioError', failed);
      sound.removeEventListener('securityError', failed);
      pending.delete(cancel);
    };
    const finish = (result: SoundObject | null) => {
      if (settled) return;
      settled = true;
      detach();
      ready(result);
    };
    const complete = () => finish(sound);
    const failed = () => finish(null);
    const cancel = () => {
      if (settled) return;
      settled = true;
      detach();
      try {
        sound.close();
      } catch {
        /* OpenFL may have already closed a failed stream. */
      }
    };
    pending.add(cancel);
    sound.addEventListener('complete', complete);
    sound.addEventListener('ioError', failed);
    sound.addEventListener('securityError', failed);
  });
  reflection.around(SoundManager.prototype, 'cacheSound', function (_next, type, key, metadata) {
    const queue = this.callbackQueue.h[key];
    let settled = false;
    const cancel = () => {
      settled = true;
      if (this.callbackQueue.h[key] === queue) delete this.callbackQueue.h[key];
      pending.delete(cancel);
    };
    pending.add(cancel);
    const finished = (sound: SoundObject | null) => {
      if (settled || disposed) return;
      cancel();
      if (sound) {
        sound.set_originalVolume(metadata.volume);
        this.soundObjects.h[key] = sound;
        sound.key = key;
        if (type === 'music') this.musicObjects.h[key] = sound;
        else {
          sound.multipleAllowed = true;
          this.effectObjects.h[key] = sound;
        }
      }
      for (const callback of queue ?? []) {
        if (disposed) break;
        try {
          callback(sound);
        } catch (error) {
          api.log('Sound load callback failed', key, error);
        }
      }
    };
    try {
      this.loadSoundFromFS(`${metadata.type}/${metadata.fileName}`, finished);
    } catch {
      finished(null);
    }
  });
}
