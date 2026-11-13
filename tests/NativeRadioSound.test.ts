import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeRadioSound } from '../src/radio/NativeRadioSound';
import { RadioAudio } from '../src/radio/RadioAudio';

function fixture() {
  class Events {
    events = new Map<string, Set<() => void>>();
    addEventListener(type: string, callback: () => void) {
      if (!this.events.has(type)) this.events.set(type, new Set());
      this.events.get(type)!.add(callback);
    }
    removeEventListener(type: string, callback: () => void) {
      this.events.get(type)?.delete(callback);
    }
    emit(type: string) {
      for (const callback of [...(this.events.get(type) ?? [])]) callback();
    }
  }
  class Transform {
    pan = 0;
    constructor(public volume = 1) {}
  }
  class Channel extends Events {
    transform = new Transform();
    stopped = 0;
    get_position() {
      return 1250;
    }
    get_soundTransform() {
      return Object.assign(new Transform(), this.transform);
    }
    set_soundTransform(value: Transform) {
      this.transform = value;
    }
    stop() {
      this.stopped++;
    }
  }
  const channel = new Channel();
  const plays: unknown[][] = [],
    loads: string[] = [];
  class Sound extends Events {
    bytesLoaded = 4096;
    isBuffering = false;
    closed = 0;
    get_length() {
      return 30000;
    }
    load(request: { url: string }) {
      loads.push(request.url);
    }
    play(...args: unknown[]) {
      plays.push(args);
      return channel;
    }
    close() {
      this.closed++;
    }
  }
  const sound = new Sound();
  const resolve = (name: string): any =>
    ({
      'openfl.media.Sound': class {
        constructor() {
          return sound;
        }
      },
      'openfl.media.SoundTransform': Transform,
      'openfl.net.URLRequest': class {
        constructor(public url: string) {}
      },
    })[name];
  return { sound, channel, plays, loads, resolve, native: new NativeRadioSound(resolve) };
}

test('native adapter maps Haxe milliseconds, events and cloned sound transforms', () => {
  const f = fixture();
  let completed = 0;
  f.native.onComplete(() => {
    completed++;
  });
  f.native.load('blob:prepared');
  assert.deepEqual(f.loads, ['blob:prepared']);
  f.sound.emit('complete');
  assert.equal(completed, 1);
  assert.equal(f.native.length, 30000);
  assert.equal(f.native.bytesLoaded, 4096);
  const channel = f.native.play(1250, 0.2)!;
  assert.equal(f.plays[0][0], 1250);
  assert.equal(f.plays[0][1], 0);
  assert.equal((f.plays[0][2] as { volume: number }).volume, 0.2);
  channel.volume = 0.07;
  assert.equal(f.channel.transform.volume, 0.07);
  assert.equal(channel.volume, 0.07);
  assert.equal(channel.position, 1250);
  f.native.close();
  assert.equal(f.channel.stopped, 1);
  f.sound.emit('complete');
  assert.equal(completed, 1);
});

test('closing before native decode completes suppresses callbacks and releases the late buffer', () => {
  const f = fixture();
  let complete = 0;
  f.native.onComplete(() => {
    complete++;
  });
  f.native.load('blob:pending');
  f.native.close();
  assert.equal(f.sound.closed, 1);
  f.sound.emit('complete');
  assert.equal(f.sound.closed, 2);
  assert.equal(complete, 0);
  assert.equal(
    [...f.sound.events.values()].some((listeners) => listeners.size > 0),
    false,
  );
  assert.equal(f.native.play(0, 1), null);
});

test('unsupported progressive loading follows RadioAudio failure path, while complete files become ready', () => {
  const f = fixture(),
    errors: string[] = [];
  const audio = new RadioAudio(
    () => new NativeRadioSound(f.resolve),
    () => 1000,
  );
  const id = 'AbC_123-xyz';
  audio.loadStream(
    id,
    'http://127.0.0.1:40123/radio/' + 'a'.repeat(64) + '/' + id + '.mp3',
    30000,
    0,
    () => {},
    (error) => {
      errors.push(error);
    },
  );
  assert.equal(errors.length, 1);
  assert.equal(f.loads.length, 0);
  let ready = 0;
  audio.load(
    id,
    { url: 'blob:prepared', exists: true, isDirectory: false, extension: 'mp3', size: 4096 },
    () => {
      ready++;
    },
    () => {},
  );
  f.sound.emit('complete');
  assert.equal(ready, 1);
  assert.equal(audio.ready, true);
  audio.sync(0, true, 0.12);
  assert.equal(audio.playing, true);
  audio.dispose();
  assert.ok(f.channel.stopped > 0);
});

test('prepared fetch settles before decoding, and closing cancels a pending fetch', async () => {
  const f = fixture();
  let finish!: (url: string) => void;
  let signal!: AbortSignal;
  const sound = new NativeRadioSound(f.resolve, (_url, abort) => {
    signal = abort;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  sound.load('http://127.0.0.1/audio/test.mp3');
  assert.equal(f.loads.length, 0);
  finish('data:audio/mp3;base64,AQID');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.loads, ['data:audio/mp3;base64,AQID']);
  sound.load('http://127.0.0.1/audio/next.mp3');
  sound.close();
  assert.equal(signal.aborted, true);
  finish('data:audio/mp3;base64,BAUG');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.loads.length, 1);
});

test('prepared fetch failures reach audio failure listeners and respect listener removal', async () => {
  const f = fixture();
  const sound = new NativeRadioSound(f.resolve, async () => {
    throw Error('fetch failed');
  });
  let failed = 0;
  const remove = sound.onFailure(() => failed++);
  sound.load('http://127.0.0.1/audio/test.mp3');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed, 1);
  remove();
  sound.load('http://127.0.0.1/audio/test.mp3');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed, 1);
  sound.close();
});
