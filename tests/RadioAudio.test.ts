import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioAudio, type RadioSound, type RadioSoundChannel } from '../src/radio/RadioAudio';
import { RadioStreamURL } from '../src/radio/RadioStreamURL';

class Channel implements RadioSoundChannel {
  stopped = false;
  complete: (() => void) | null = null;
  constructor(
    public position: number,
    public volume: number,
  ) {}
  onComplete(callback: () => void) {
    this.complete = callback;
    return () => {
      this.complete = null;
    };
  }
  stop() {
    this.stopped = true;
  }
}
class Sound implements RadioSound {
  length = 0;
  bytesLoaded = 0;
  isBuffering = false;
  closed = false;
  loads: unknown[][] = [];
  channels: Channel[] = [];
  callbacks = new Map<string, () => void>();
  on(type: string, callback: () => void) {
    this.callbacks.set(type, callback);
    return () => {
      this.callbacks.delete(type);
    };
  }
  onComplete(callback: () => void) {
    return this.on('complete', callback);
  }
  onProgress(callback: () => void) {
    return this.on('progress', callback);
  }
  onFailure(callback: () => void) {
    return this.on('failure', callback);
  }
  load(...args: [string, number?]) {
    this.loads.push(args);
  }
  play(position: number, volume: number) {
    const channel = new Channel(position, volume);
    this.channels.push(channel);
    return channel;
  }
  close() {
    this.closed = true;
  }
  emit(type: string) {
    this.callbacks.get(type)?.();
  }
}
const id = 'AbC_123-xy'; // Deliberately invalid length for endpoint validation.
const video = 'AbC_123-xyz';
const url = `http://127.0.0.1:40123/radio/${'a'.repeat(64)}/${video}.mp3`;
const file = {
  url: 'blob:prepared-audio',
  exists: true,
  isDirectory: false,
  extension: 'mp3',
  size: 1024,
};
function fixture() {
  let now = 0,
    ready = 0;
  const sounds: Sound[] = [],
    errors: string[] = [];
  const audio = new RadioAudio(
    () => {
      const sound = new Sound();
      sounds.push(sound);
      return sound;
    },
    () => now,
  );
  return {
    audio,
    sounds,
    errors,
    ready: () => ready,
    advance: (ms: number) => {
      now += ms;
    },
    onReady: () => {
      ready++;
    },
    onError: (message: string) => errors.push(message),
  };
}

test('radio stream accepts only the exact authenticated helper endpoint and video', () => {
  assert.equal(RadioStreamURL.valid(url, video), true);
  for (const candidate of [
    url.replace('127.0.0.1', 'localhost'),
    url.replace(':40123', ':0'),
    url.replace(':40123', ':65536'),
    url + '?extra',
    url.replace('/radio/', '/other/'),
    url.replace('a'.repeat(64), 'A'.repeat(64)),
  ])
    assert.equal(RadioStreamURL.valid(candidate, video), false);
  assert.equal(RadioStreamURL.valid(url, id), false);
});

test('stream readiness requires decoded position plus five seconds and reports truncation', () => {
  const f = fixture();
  f.audio.loadStream(video, url, 60000, 10000, f.onReady, f.onError);
  const sound = f.sounds[0];
  assert.deepEqual(sound.loads, [[url, 5000]]);
  sound.length = 14899;
  sound.bytesLoaded = 100;
  sound.emit('progress');
  assert.equal(f.audio.ready, false);
  sound.length = 14900;
  sound.emit('progress');
  assert.equal(f.audio.ready, true);
  assert.equal(f.ready(), 1);
  sound.emit('progress');
  assert.equal(f.ready(), 1);
  sound.length = 58000;
  sound.emit('complete');
  assert.equal(f.audio.ready, false);
  assert.match(f.errors[0], /before the complete song/);
  assert.equal(sound.closed, true);
});

test('radio synchronization preserves source drift threshold, correction cooldown and end behavior', () => {
  const f = fixture();
  f.audio.load(video, file, f.onReady, f.onError);
  const sound = f.sounds[0];
  sound.length = 60000;
  sound.emit('complete');
  f.audio.sync(1000, true, 2);
  assert.equal(sound.channels[0].volume, 1);
  f.advance(3000);
  f.audio.sync(3000, true, 0.5);
  assert.equal(sound.channels.length, 1, 'strictly greater than three seconds');
  f.advance(1);
  f.audio.sync(1900, true, 0.5);
  assert.equal(sound.channels.length, 1, '900ms drift is tolerated');
  f.audio.sync(1901, true, 0.5);
  assert.equal(sound.channels.length, 2);
  assert.equal(sound.channels[0].stopped, true);
  sound.channels[1].complete!();
  f.audio.sync(59100, true, 1);
  assert.equal(f.audio.status, 'Waiting for next track');
  assert.equal(sound.channels.length, 2);
  f.audio.sync(0, true, NaN);
  assert.equal(sound.channels.length, 3);
  assert.equal(f.audio.playing, false, 'muted playback is not audible');
  f.audio.pause();
  assert.equal(f.audio.status, 'Paused');
});

test('stream starvation, prepared timeout and stale callbacks clear all owned audio', () => {
  const f = fixture();
  f.audio.load(video, file, f.onReady, f.onError);
  const old = f.sounds[0],
    late = old.callbacks.get('complete')!;
  f.advance(15001);
  f.audio.sync(0, true, 1);
  assert.match(f.errors[0], /timed out/);
  f.audio.loadStream(video, url, 60000, 0, f.onReady, f.onError);
  old.length = 60000;
  late();
  assert.equal(f.ready(), 0);
  const sound = f.sounds[1];
  sound.length = 6000;
  sound.bytesLoaded = 500;
  sound.emit('progress');
  f.audio.sync(0, true, 1);
  sound.isBuffering = true;
  f.audio.sync(1000, true, 1);
  assert.equal(f.audio.ready, false);
  assert.equal(sound.channels[0].stopped, true);
  f.advance(20001);
  f.audio.sync(1000, true, 1);
  assert.match(f.errors[1], /stopped receiving data/);
  assert.equal(sound.callbacks.size, 0);
  assert.equal(sound.closed, true);
  assert.equal(f.audio.videoId, '');
});

test('invalid prepared files and oversized streams fail before playback', () => {
  const f = fixture();
  f.audio.load(video, { ...file, size: 0 }, f.onReady, f.onError);
  assert.equal(f.sounds.length, 0);
  f.audio.loadStream(video, url, 60000, 0, f.onReady, f.onError);
  const sound = f.sounds[0];
  sound.bytesLoaded = 40 * 1024 * 1024 + 1;
  sound.emit('progress');
  assert.match(f.errors.at(-1)!, /size limit/);
  assert.equal(sound.channels.length, 0);
});
