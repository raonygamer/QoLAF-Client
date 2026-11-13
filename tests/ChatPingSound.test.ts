import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { ChatPingSound } from '../src/chat/ChatPingSound';

function fixture() {
  let volume = 0.5;
  const sounds: Sound[] = [];
  class Events {
    handlers = new Map<string, Set<() => void>>();
    addEventListener(event: string, fn: () => void) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)!.add(fn);
    }
    removeEventListener(event: string, fn: () => void) {
      this.handlers.get(event)?.delete(fn);
    }
    dispatch(event: string) {
      for (const fn of this.handlers.get(event) ?? []) fn();
    }
  }
  class Channel extends Events {
    stopped = false;
    stop() {
      this.stopped = true;
    }
  }
  class Sound extends Events {
    request!: { url: string };
    closed = false;
    channels: Channel[] = [];
    calls: [number, number, { volume: number }][] = [];
    constructor() {
      super();
      sounds.push(this);
    }
    load(request: { url: string }) {
      this.request = request;
    }
    close() {
      this.closed = true;
    }
    play(...args: [number, number, { volume: number }]) {
      this.calls.push(args);
      const channel = new Channel();
      this.channels.push(channel);
      return channel;
    }
  }
  const classes: Record<string, unknown> = {
    'openfl.media.Sound': Sound,
    'openfl.media.SoundChannel': Channel,
    'openfl.net.URLRequest': class {
      constructor(public url: string) {}
    },
    'openfl.media.SoundTransform': class {
      constructor(public volume: number) {}
    },
    'sound.SoundLocator': { getService: () => ({ get_effectVolume: () => volume }) },
  };
  const api = { cls: (name: string) => classes[name] ?? {} } as unknown as API;
  bindGameClasses(api);
  return {
    sounds,
    ping: new ChatPingSound('data:audio/mpeg;base64,test'),
    setVolume: (next: number) => {
      volume = next;
    },
  };
}

test('ping loads once, uses current native effect volume and allows overlapping notifications', () => {
  const f = fixture();
  f.ping.play();
  f.ping.play();
  assert.equal(f.sounds.length, 1);
  const sound = f.sounds[0];
  assert.equal(sound.request.url, 'data:audio/mpeg;base64,test');
  assert.equal(sound.calls.length, 0);
  f.setVolume(0.2);
  sound.dispatch('complete');
  assert.equal(sound.calls.length, 2);
  assert.deepEqual(sound.calls[0].slice(0, 2), [0, 0]);
  assert.equal(sound.calls[0][2].volume, 0.2);
  sound.channels[0].dispatch('soundComplete');
  assert.equal(sound.channels[0].handlers.get('soundComplete')?.size, 0);
  f.setVolume(0.8);
  f.ping.play();
  assert.equal(sound.calls[2][2].volume, 0.8);
  f.ping.dispose();
  assert.equal(sound.closed, true);
  assert.equal(sound.channels[0].stopped, false, 'completed channels are no longer retained');
  assert.equal(sound.channels[1].stopped, true);
  assert.equal(sound.channels[2].stopped, true);
});

test('muting before or during load suppresses sound and disposed loads cannot play', () => {
  const f = fixture();
  f.setVolume(0);
  f.ping.play();
  assert.equal(f.sounds.length, 0);
  f.setVolume(0.5);
  f.ping.play();
  f.setVolume(0);
  f.sounds[0].dispatch('complete');
  assert.equal(f.sounds[0].calls.length, 0);
  f.setVolume(NaN);
  f.ping.play();
  assert.equal(f.sounds[0].calls.length, 0);
  f.ping.dispose();
  const other = fixture();
  other.ping.play();
  const sound = other.sounds[0];
  const callback = [...sound.handlers.get('complete')!][0];
  other.ping.dispose();
  callback();
  other.ping.play();
  assert.equal(sound.calls.length, 0);
  assert.equal(other.sounds.length, 1);
  assert.equal(sound.handlers.get('complete')?.size, 0);
  assert.equal(sound.handlers.get('ioError')?.size, 0);
});

test('failed loading is contained and a subsequent notification can retry', () => {
  const f = fixture();
  f.ping.play();
  f.sounds[0].dispatch('ioError');
  assert.equal(f.sounds[0].closed, true);
  assert.equal(f.sounds[0].calls.length, 0);
  f.ping.play();
  assert.equal(f.sounds.length, 2);
  f.sounds[1].dispatch('complete');
  assert.equal(f.sounds[1].calls.length, 1);
  f.ping.dispose();
});
