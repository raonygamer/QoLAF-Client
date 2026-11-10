import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMusicPlayer } from '../src/music/MusicPlayer';
import { createMusicTrackCatalog } from '../src/music/MusicTrackCatalog';
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
    musicObjects = { h: {} as Record<string, any> };
    soundObjects = { h: {} as Record<string, any> };
    effectObjects = { h: {} as Record<string, any> };
    get_musicVolume() {
      return 1;
    }
    getSoundObject(key: string, ready: Function) {
      pending.push(() => {
        const listeners = new Set<Function>();
        const object: any = (this.soundObjects.h[key] ??= {
          key,
          isPlaying: false,
          pauses: 0,
          get_originalVolume: () => 1,
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
    playMusic(..._args: any[]) {}
    internalPlay(..._args: any[]) {}
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
  const classes: any = {
    'sound.SoundManager': Manager,
    'sound.SoundLocator': locator,
    'data.DataLocator': data,
    'core.scene.SceneBase': scene,
  };
  const cleanup: Function[] = [];
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
    around(target: any, name: string, fn: Function) {
      const original = target[name];
      target[name] = function (...args: any[]) {
        return fn.call(this, original.bind(this), ...args);
      };
      cleanup.push(() => {
        target[name] = original;
      });
    },
    before(target: any, name: string, fn: Function) {
      this.around(target, name, function (this: any, next: Function, ...args: any[]) {
        fn.apply(this, args);
        return next(...args);
      });
    },
  };
  const player = createMusicPlayer((name) => classes[name]);
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
