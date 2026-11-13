// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMusicPlayer } from '../src/music/MusicPlayer';
import { createMusicTrackCatalog } from '../src/music/MusicTrackCatalog';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeMusicPlayback } from '../src/music/NativeMusicPlayback';

function harness() {
  const sounds: any = {
    a: { type: 'music', fileName: 'theme.mp3', volume: 1 },
    b: { type: 'music', fileName: 'theme_steve.mp3', volume: 1 },
  };
  const saved: Record<string, any> = {};
  const scene = {
    clientSettings: {
      getMusicPlayerState: (id: string) =>
        saved[id] ?? {
          manual: false,
          trackKey: '',
          selectedTrackKey: '',
          loop: true,
          state: 'stopped',
        },
      setMusicPlayerState: (id: string, state: any) => {
        saved[id] = state;
      },
    },
  };
  const starts: string[] = [];
  const pending: Array<() => void> = [];
  class Manager {
    loadSoundFromUrl() {
      throw Error('unexpected transport request in playback fixture');
    }
    cacheSound() {
      throw Error('unexpected cache request in playback fixture');
    }
    musicObjects = { h: {} as Record<string, any> };
    soundObjects = { h: {} as Record<string, any> };
    effectObjects = { h: {} as Record<string, any> };
    failLoad = false;
    _musicVolume = 1;
    get_musicVolume() {
      return this._musicVolume;
    }
    set_musicVolume(volume: number) {
      this._musicVolume = volume;
      for (const object of Object.values(this.musicObjects.h))
        object.set_volume(object.get_originalVolume() * volume);
      this.playMusic('a');
      return volume;
    }
    getSoundObject(key: string, ready: Function) {
      pending.push(() => {
        if (this.failLoad) {
          ready(null);
          return;
        }
        const listeners = new Set<Function>();
        const object: any = (this.soundObjects.h[key] ??= {
          key,
          isPlaying: false,
          pauses: 0,
          get_originalVolume: () => 1,
          volume: 1,
          set_volume: (volume: number) => {
            object.volume = volume;
          },
          playObject: () => {
            starts.push(key);
            object.isPlaying = true;
            return (object.channel = {
              addEventListener: (_: string, fn: Function) => listeners.add(fn),
              removeEventListener: (_: string, fn: Function) => listeners.delete(fn),
              complete: () => {
                for (const fn of [...listeners]) fn();
              },
            });
          },
          resume: () => object.playObject(),
          pause: () => {
            object.isPlaying = false;
            object.pauses++;
          },
          stop: () => {
            object.isPlaying = false;
          },
          fadeStop: () => {
            object.isPlaying = false;
          },
        });
        ready(object);
      });
    }
    preCacheSound(key: string, ready: () => void) {
      this.getSoundObject(key, () => ready());
    }
    playMusic(..._args: any[]) {}
    internalPlay(
      type: string,
      key: string,
      loop: boolean,
      resume: boolean,
      onLoad?: (channel: any) => void,
      onComplete?: () => void,
    ) {
      this.getSoundObject(key, (sound: any) => {
        const volume = sound.get_originalVolume();
        const channel = resume ? sound.resume(volume, loop) : sound.playObject(volume, loop);
        if (onComplete) channel.addEventListener('soundComplete', onComplete);
        onLoad?.(channel);
      });
    }
    stop(..._args: any[]) {}
    stopMusic() {}
    stopAllMusicExcept(..._args: any[]) {}
    stopAll() {}
  }
  let current = new Manager();
  const locator = {
    getService: () => current,
    register: (service: Manager) => {
      current = service;
    },
  };
  const data = {
    getService: () => ({
      loadTable: (name: string) => (name === 'Sounds' ? sounds : {}),
      loadKey: (_: string, key: string) => sounds[key],
    }),
  };
  class Intro {
    constructor(readonly soundManager: Manager) {}
    enter() {
      this.soundManager.preCacheSound('b', () => {
        this.soundManager.stopAll();
        this.soundManager.internalPlay('effects', 'b', false, false);
      });
    }
  }
  const classes: any = {
    'core.states.gameStates.IntroState': Intro,
    'sound.SoundManager': Manager,
    'sound.SoundLocator': locator,
    'data.DataLocator': data,
    'core.scene.SceneBase': scene,
    'com.greensock.TweenMax': { killTweensOf() {} },
  };
  const cleanup: Function[] = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
    around(target: any, name: string, fn: Function) {
      const remove = hooks.add(target, name, 'around', fn);
      cleanup.push(remove);
      return remove;
    },
    before(target: any, name: string, fn: Function) {
      const remove = hooks.add(target, name, 'before', fn);
      cleanup.push(remove);
      return remove;
    },
  };
  const player = createMusicPlayer((name) => classes[name]);
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? {} });
  installNativeMusicPlayback(api, player);
  player.restoreForAccount('first');
  return {
    player,
    current,
    saved,
    pending,
    starts,
    sounds,
    locator,
    Manager,
    Intro,
    resolve: (name: string) => classes[name],
    cleanup: () => cleanup.reverse().forEach((fn) => fn()),
  };
}

test('cached catalog rejects URLs and sorts detached music metadata', () => {
  const h = harness();
  try {
    h.sounds.invalid = { type: 'music', fileName: 'https://other/song.mp3' };
    h.sounds.effect = { type: 'effects', fileName: 'shot.mp3' };
    const catalog = createMusicTrackCatalog(h.resolve);
    assert.deepEqual(
      catalog.getTracks().map((row) => row.title),
      ['Fulzar (Steve)', 'Original Theme'],
    );
    assert.equal(h.pending.length, 0);
  } finally {
    h.cleanup();
  }
});

test('Stop invalidates a pending load and blocks automatic music without loading audio to stop', () => {
  const h = harness();
  try {
    h.player.play('a', true);
    assert.equal(h.pending.length, 1);
    h.player.stop();
    h.current.playMusic('b');
    h.pending.shift()!();
    assert.deepEqual(h.starts, []);
    assert.equal(h.player.status, 'Stopped');
    assert.equal(h.pending.length, 0);
    h.player.useGameMusic();
    h.pending.shift()!();
    assert.deepEqual(h.starts, ['b']);
  } finally {
    h.cleanup();
  }
});

test('a replaced request cannot start late and pause resumes the selected track', () => {
  const h = harness();
  try {
    h.player.play('a', false);
    h.player.play('b', false);
    h.pending.shift()!();
    h.pending.shift()!();
    assert.deepEqual(h.starts, ['b']);
    assert.equal(h.player.status, 'Playing');
    h.player.pause();
    assert.equal(h.player.status, 'Paused');
    h.current.playMusic('a');
    assert.equal(h.pending.length, 0);
    h.player.resume();
    h.pending.shift()!();
    assert.deepEqual(h.starts, ['b', 'b']);
  } finally {
    h.cleanup();
  }
});

test('loop changes apply at completion and stop detaches old completion callbacks', () => {
  const h = harness();
  try {
    h.player.play('a', true);
    h.pending.shift()!();
    h.current.soundObjects.h.a.channel.complete();
    assert.equal(h.pending.length, 1);
    h.pending.shift()!();
    h.player.setLoop(false);
    h.current.soundObjects.h.a.channel.complete();
    assert.equal(h.player.status, 'Stopped');
    assert.equal(h.pending.length, 0);
    h.player.play('a', true);
    h.pending.shift()!();
    const old = h.current.soundObjects.h.a.channel;
    h.player.stop();
    old.complete();
    assert.equal(h.pending.length, 0);
  } finally {
    h.cleanup();
  }
});

test('room restores preserve playback, service replacement invalidates callbacks, paused restore stays silent', () => {
  const h = harness();
  try {
    h.player.play('a', true);
    h.player.restoreForAccount('first');
    assert.equal(h.pending.length, 1);
    h.locator.register(new h.Manager());
    h.pending.shift()!();
    assert.deepEqual(h.starts, []);
    assert.equal(h.saved.first.state, 'playing');
    h.saved.second = {
      manual: true,
      trackKey: 'b',
      selectedTrackKey: 'b',
      loop: false,
      state: 'paused',
    };
    h.player.restoreForAccount('second');
    assert.equal(h.player.status, 'Paused');
    assert.equal(h.pending.length, 0);
  } finally {
    h.cleanup();
  }
});

test('Radio ownership cancels pending automatic audio and restores the latest game request on release', () => {
  const h = harness();
  try {
    const radio = {};
    h.current.playMusic('a');
    assert.equal(h.pending.length, 1);
    const saved = JSON.stringify(h.saved);
    assert.equal(
      h.player.acquireExternal(radio, () => {}),
      true,
    );
    h.pending.shift()!();
    assert.deepEqual(h.starts, []);
    h.current.playMusic('b');
    assert.equal(h.pending.length, 0);
    assert.equal(
      h.player.acquireExternal({}, () => {}),
      false,
    );
    h.player.releaseExternal({});
    assert.equal(h.pending.length, 0);
    h.player.releaseExternal(radio);
    assert.equal(h.pending.length, 1);
    h.pending.shift()!();
    assert.deepEqual(h.starts, ['b']);
    assert.equal(JSON.stringify(h.saved), saved);
  } finally {
    h.cleanup();
  }
});

test('Radio preserves manual playback preferences and explicit music takeover avoids a transient resume', () => {
  const h = harness();
  try {
    h.player.play('a', true);
    h.pending.shift()!();
    const radio = {},
      saved = JSON.stringify(h.saved);
    let released = 0;
    const leave = () => {
      released++;
      h.player.releaseExternal(radio);
    };
    assert.equal(h.player.acquireExternal(radio, leave), true);
    assert.equal(JSON.stringify(h.saved), saved);
    h.current.playMusic('b');
    h.player.play('b', false);
    assert.equal(released, 1);
    assert.equal(h.pending.length, 1);
    h.pending.shift()!();
    assert.deepEqual(h.starts, ['a', 'b']);
    h.player.acquireExternal(radio, leave);
    h.player.releaseExternal(radio);
    h.pending.shift()!();
    assert.deepEqual(h.starts, ['a', 'b', 'b']);
  } finally {
    h.cleanup();
  }
});

test('Radio release respects paused manual music and service teardown invokes its takeover callback', () => {
  const h = harness();
  try {
    h.player.play('a', true);
    h.pending.shift()!();
    h.player.pause();
    const radio = {};
    let released = 0;
    h.player.acquireExternal(radio, () => {
      released++;
    });
    h.player.releaseExternal(radio);
    assert.equal(h.pending.length, 0);
    assert.equal(h.player.paused, true);
    h.player.acquireExternal(radio, () => {
      released++;
    });
    h.player.onServiceStopped(h.current);
    assert.equal(released, 1);
    assert.equal(h.player.manual, false);
  } finally {
    h.cleanup();
  }
});

test('protected manual music still completes a native stop callback without stopping playback', () => {
  const h = harness();
  try {
    h.player.play('a', true);
    h.pending.shift()!();
    let completed = 0;
    h.current.stop('a', () => completed++);
    assert.equal(completed, 1);
    assert.equal(h.current.soundObjects.h.a.isPlaying, true);
    assert.equal(h.player.status, 'Playing');
  } finally {
    h.cleanup();
  }
});

test('promoting an effect-cached sound to music stops its earlier channels first', () => {
  const h = harness();
  try {
    h.current.getSoundObject('a', () => {});
    h.pending.shift()!();
    const sound = h.current.soundObjects.h.a;
    sound.multipleAllowed = true;
    sound.key = 'stale-cache-key';
    h.current.effectObjects.h.a = sound;
    const order: string[] = [];
    const originalStop = sound.stop;
    sound.stop = () => {
      order.push('stop');
      originalStop();
    };
    const originalPlay = sound.playObject;
    sound.playObject = () => {
      order.push('play');
      return originalPlay();
    };
    h.current.playMusic('a', true);
    h.pending.shift()!();
    assert.deepEqual(order, ['stop', 'play']);
    assert.equal(sound.key, 'a');
    assert.equal(sound.multipleAllowed, false);
    assert.equal(h.current.musicObjects.h.a, sound);
    assert.equal(h.current.effectObjects.h.a, undefined);
  } finally {
    h.cleanup();
  }
});

test('stopping a loading effect cancels only its old playback, not later plays or precache reads', () => {
  const h = harness();
  try {
    let loaded = 0;
    h.current.internalPlay('effects', 'a', false, false, () => loaded++);
    h.current.stop('a');
    h.current.getSoundObject('a', () => loaded++);
    h.current.internalPlay('effects', 'a', false, false, () => loaded++);
    h.pending.splice(0).forEach((ready) => ready());
    assert.deepEqual(h.starts, ['a']);
    assert.equal(loaded, 2, 'precache and new playback survive the old stop');
  } finally {
    h.cleanup();
  }
});

test('stopAll, service replacement and unsafe unload retire late native effect loads', () => {
  for (const action of ['stopAll', 'replace', 'unload']) {
    const h = harness();
    let cleaned = false;
    try {
      h.current.internalPlay('effects', 'a', false, false);
      if (action === 'stopAll') h.current.stopAll();
      else if (action === 'replace') h.locator.register(new h.Manager());
      else {
        h.cleanup();
        cleaned = true;
      }
      h.pending.shift()!();
      assert.deepEqual(h.starts, [], action);
    } finally {
      if (!cleaned) h.cleanup();
    }
  }
});

test('stopped effects cannot run stale completion callbacks', () => {
  const h = harness();
  try {
    let completed = 0;
    h.current.internalPlay('effects', 'a', false, false, undefined, () => completed++);
    h.pending.shift()!();
    const channel = h.current.soundObjects.h.a.channel;
    h.current.stop('a');
    channel.complete();
    assert.equal(completed, 0);
  } finally {
    h.cleanup();
  }
});

test('intro sound reset preserves manual music and cancels earlier queued effects', () => {
  const h = harness();
  try {
    h.player.play('a', true);
    h.pending.shift()!();
    const music = h.current.soundObjects.h.a;
    h.current.internalPlay('effects', 'b', false, false);
    const oldEffect = h.pending.shift()!;
    new h.Intro(h.current).enter();
    h.pending.shift()!();
    oldEffect();
    h.pending.shift()!();
    assert.deepEqual(h.starts, ['a', 'b']);
    assert.equal(music.isPlaying, true);
    assert.equal(h.player.status, 'Playing');
  } finally {
    h.cleanup();
  }
});

test('stopping the active automatic track clears its resume request', () => {
  const h = harness();
  try {
    h.current.playMusic('a');
    h.pending.shift()!();
    h.current.stop('a');
    h.player.play('b', false);
    h.pending.shift()!();
    h.player.useGameMusic();
    assert.equal(h.pending.length, 0, 'returning to game music must not revive stopped track a');
    assert.deepEqual(h.starts, ['a', 'b']);
  } finally {
    h.cleanup();
  }
});

test('music volume changes preserve the current theme and pause outgoing tracks', () => {
  const h = harness();
  try {
    h.current.playMusic('a');
    h.pending.shift()!();
    h.current.playMusic('b');
    h.pending.shift()!();
    const outgoing = h.current.musicObjects.h.a;
    const active = h.current.musicObjects.h.b;
    outgoing.isPlaying = true;
    assert.equal(h.current.set_musicVolume(0), 0);
    assert.equal(h.pending.length, 0, 'volume must not restart the solar-system playlist');
    assert.equal(outgoing.isPlaying, false);
    assert.equal(active.isPlaying, true, 'muting preserves the active channel');
    assert.equal(active.volume, 0);
    assert.equal(h.current.set_musicVolume(0.6), 0.6);
    assert.equal(active.volume, 0.6);
    assert.equal(h.pending.length, 0);
    assert.deepEqual(h.starts, ['a', 'b']);
  } finally {
    h.cleanup();
  }
});

test('failed sound loads complete playback with null and do not complete precache', () => {
  const h = harness();
  try {
    h.current.failLoad = true;
    const loaded: unknown[] = [];
    let cached = false;
    h.current.playMusic('a', false, false, (channel: unknown) => loaded.push(channel));
    h.current.internalPlay('effects', 'b', false, false, (channel) => loaded.push(channel));
    h.current.preCacheSound('b', () => {
      cached = true;
    });
    while (h.pending.length) h.pending.shift()!();
    assert.deepEqual(loaded, [null, null]);
    assert.equal(cached, false);
    assert.deepEqual(h.starts, []);
  } finally {
    h.cleanup();
  }
});

test('missing effect metadata reaches the playback failure guard with real host hook order', () => {
  const h = harness();
  try {
    const loaded: unknown[] = [];
    assert.doesNotThrow(() =>
      h.current.internalPlay('effects', 'missing', false, false, (channel) => loaded.push(channel)),
    );
    assert.deepEqual(loaded, [null]);
    assert.equal(h.pending.length, 0);
    assert.deepEqual(h.starts, []);
  } finally {
    h.cleanup();
  }
});
