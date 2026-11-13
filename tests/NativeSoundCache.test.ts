import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeSoundCache } from '../src/music/NativeSoundCache';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('failed sound queues release before retry, notify all consumers, and unload cleanly', () => {
  const sounds: Sound[] = [];
  class Sound extends EventTarget {
    closed = false;
    key = '';
    multipleAllowed = false;
    volume = 0;
    constructor(readonly url: string) {
      super();
      sounds.push(this);
    }
    set_originalVolume(volume: number) {
      this.volume = volume;
      return volume;
    }
    close() {
      this.closed = true;
    }
  }
  type Ready = (sound: Sound | null) => void;
  const lookups: string[] = [];
  const metadata = { type: 'effects', fileName: 'shot.mp3', volume: 0.5 };
  class Manager {
    callbackQueue = { h: {} as Record<string, Ready[]> };
    soundObjects = { h: {} as Record<string, Sound> };
    musicObjects = { h: {} as Record<string, Sound> };
    effectObjects = { h: {} as Record<string, Sound> };
    getSoundObject(key: string | null, ready: Ready) {
      if (key !== null && Object.hasOwn(this.soundObjects.h, key)) ready(this.soundObjects.h[key]);
    }
    loadSoundFromUrl(_url: string, _ready: Ready) {
      throw Error('unpatched');
    }
    loadSoundFromFS(url: string, ready: Ready) {
      this.loadSoundFromUrl(url, ready);
    }
    cacheSound(_type: string, _key: string, _metadata: typeof metadata) {
      throw Error('unpatched');
    }
  }
  const cleanups: Array<() => void> = [];
  const errors: unknown[][] = [];
  const hooks = new Hooks();
  const api = {
    cls: (name: string) =>
      name === 'sound.SoundManager'
        ? Manager
        : name === 'sound.SoundObject'
          ? Sound
          : name === 'data.DataLocator'
            ? {
                getService: () => ({
                  loadKey: (_table: string, key: string) => {
                    lookups.push(key);
                    return null;
                  },
                }),
              }
            : class {},
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    log: (...values: unknown[]) => errors.push(values),
    around: (owner: object, method: string, callback: (...args: never[]) => unknown) => {
      const remove = hooks.add(owner, method, 'around', callback);
      cleanups.push(remove);
      return remove;
    },
  } as unknown as API;
  bindGameClasses(api);
  installNativeSoundCache(api);
  const manager = new Manager();
  const results: Array<Sound | null> = [];
  try {
    let missing = 0;
    for (const key of [null, 'missing']) {
      manager.getSoundObject(key, (sound) => {
        assert.equal(sound, null);
        missing++;
      });
    }
    assert.equal(missing, 2);
    assert.deepEqual(lookups, ['missing']);
    assert.equal(sounds.length, 0, 'invalid keys must not start a download');
    manager.callbackQueue.h.shot = [
      (sound) => {
        results.push(sound);
        assert.equal(manager.callbackQueue.h.shot, undefined);
        manager.callbackQueue.h.shot = [(sound) => results.push(sound)];
        manager.cacheSound('effects', 'shot', metadata);
        throw Error('consumer failure');
      },
      (sound) => results.push(sound),
    ];
    manager.cacheSound('effects', 'shot', metadata);
    sounds[0].dispatchEvent(new Event('ioError'));
    assert.equal(results.length, 2);
    assert.equal(results[0], null);
    assert.equal(results[1], null);
    assert.equal(errors.length, 1);
    assert.equal(sounds.length, 2);
    assert.equal(manager.callbackQueue.h.shot.length, 1);
    sounds[0].dispatchEvent(new Event('complete'));
    assert.equal(results.length, 2, 'late completion must not settle the failed load twice');
    sounds[1].dispatchEvent(new Event('complete'));
    assert.equal(results[2], sounds[1]);
    assert.equal(manager.effectObjects.h.shot, sounds[1]);
    let cached: Sound | null = null;
    manager.getSoundObject('shot', (sound) => {
      cached = sound;
    });
    assert.equal(cached, sounds[1]);
    assert.deepEqual(lookups, ['missing'], 'cached sound needs no metadata lookup');
    assert.equal(sounds[1].volume, 0.5);
    assert.equal(sounds[1].multipleAllowed, true);
    assert.equal(manager.callbackQueue.h.shot, undefined);
    manager.callbackQueue.h.other = [(sound) => results.push(sound)];
    manager.cacheSound('music', 'other', metadata);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  assert.equal(sounds[2].closed, true);
  assert.equal(manager.callbackQueue.h.other, undefined);
  sounds[2].dispatchEvent(new Event('complete'));
  assert.equal(results.length, 3);
});
