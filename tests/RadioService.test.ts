import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RadioService,
  type RadioMediaTransport,
  type RadioMediaReply,
  type RadioServiceEnvironment,
} from '../src/radio/RadioService';
import { RadioAudio, type RadioSound } from '../src/radio/RadioAudio';
import type { RadioRoomTransport } from '../src/radio/RadioRooms';

function fixture() {
  let time = 0,
    volume: number | null = 0.12,
    leaving = false,
    timerStopped = false;
  let acquired = 0,
    released = 0,
    started = 0;
  const sockets: RadioRoomTransport & { peerLoginInfo(id: string): { name: string } | null } = {
    connected: true,
    paused: false,
    sessionId: 'host-session',
    ownLoginInfo: () => ({ id: 'host' }),
    peerLoginInfo: () => null,
    peerSessionId: () => null,
    addMessageHandler: () => {},
    removeMessageHandler: () => {},
    addDisposeHandler: () => {},
    removeDisposeHandler: () => {},
    send: () => true,
    broadcast: (_message, callbacks) => {
      callbacks.beforeSend?.();
      callbacks.onSent?.();
      return true;
    },
  };
  class Transport implements RadioMediaTransport {
    available = true;
    canSetup = false;
    busy = false;
    status = 'Ready';
    terminalFailure = false;
    preparedFileError = 'Invalid file';
    cancelled = 0;
    disposed = false;
    jobs: {
      operation: string;
      fields: { query?: string; videoId?: string };
      complete: (reply: RadioMediaReply) => void;
      failed: (reason: string) => void;
      progress?: (reply: RadioMediaReply) => void;
    }[] = [];
    start(ready: () => void) {
      started++;
      ready();
    }
    request(
      operation: 'setup' | 'resolve' | 'stream' | 'prepare',
      fields: { query?: string; videoId?: string },
      complete: (reply: RadioMediaReply) => void,
      failed: (reason: string) => void,
      progress?: (reply: RadioMediaReply) => void,
    ) {
      this.busy = true;
      this.jobs.push({
        operation,
        fields,
        complete: (reply) => {
          this.busy = false;
          complete(reply);
        },
        failed: (reason) => {
          this.busy = false;
          failed(reason);
        },
        progress,
      });
      return true;
    }
    preparedFile(path: string | undefined) {
      return path === 'valid'
        ? { url: 'blob:audio', exists: true, isDirectory: false, extension: 'mp3', size: 4096 }
        : null;
    }
    tick() {}
    cancel() {
      this.busy = false;
      this.cancelled++;
    }
    dispose() {
      this.disposed = true;
    }
  }
  const sounds: { complete: () => void; played: number[]; volumes: number[] }[] = [];
  const audio = new RadioAudio(
    () => {
      const events = { complete: () => {}, played: [] as number[], volumes: [] as number[] };
      sounds.push(events);
      const sound: RadioSound = {
        length: 30000,
        bytesLoaded: 4096,
        isBuffering: false,
        onComplete: (callback) => {
          events.complete = callback;
          return () => {};
        },
        onProgress: () => () => {},
        onFailure: () => () => {},
        load: () => {},
        close: () => {},
        play: (position, level) => {
          events.played.push(position);
          events.volumes.push(level);
          return { position, volume: level, onComplete: () => () => {}, stop: () => {} };
        },
      };
      return sound;
    },
    () => time,
  );
  const transports: Transport[] = [];
  const environment: RadioServiceEnvironment = {
    now: () => time,
    every: () => () => {
      timerStopped = true;
    },
    ipc: () => sockets,
    game: () => ({
      networkServerTime: time + 100000,
      isLeaving: leaving,
      me: { id: 'host', name: 'Player' },
    }),
    musicVolume: () => volume,
    acquireMusic: () => {
      acquired++;
      return true;
    },
    releaseMusic: () => {
      released++;
    },
    createTransport: () => {
      const transport = new Transport();
      transports.push(transport);
      return transport;
    },
    createAudio: () => audio,
    notice: () => {},
  };
  const service = new RadioService(environment);
  return {
    service,
    transports,
    sounds,
    audio,
    sockets,
    environment,
    step: (ms = 250) => {
      time += ms;
      service.tick();
    },
    setVolume: (v: number | null) => {
      volume = v;
    },
    setLeaving: (v: boolean) => {
      leaving = v;
    },
    acquired: () => acquired,
    released: () => released,
    started: () => started,
    timerStopped: () => timerStopped,
  };
}
const resolved = { videoId: 'AbC_123-xyz', title: 'Track', durationMs: 30000 };
function resolve(f: ReturnType<typeof fixture>) {
  f.service.create('Radio');
  f.service.add('song');
  f.step();
  const transport = f.transports[0];
  assert.equal(transport.jobs[0].operation, 'resolve');
  transport.jobs[0].complete(resolved);
  f.step();
  return transport;
}

test('constructing/opening the service does not install tools, join rooms or acquire music', () => {
  const f = fixture();
  assert.equal(f.service.rooms.joined, false);
  assert.equal(f.transports[0].jobs.length, 0);
  assert.equal(f.acquired(), 0);
  assert.equal(f.started(), 0);
  f.service.open();
  f.service.open();
  assert.equal(f.started(), 1);
  assert.equal(f.transports[0].jobs.length, 0);
  assert.equal(f.acquired(), 0);
});

test('lookup, prepared audio, shared start time and stop use the real coordinator/audio state machines', () => {
  const f = fixture(),
    transport = resolve(f);
  assert.equal(transport.jobs[1].operation, 'stream');
  transport.jobs[1].complete({ videoId: resolved.videoId, path: 'valid' });
  f.step();
  assert.equal(f.sounds.length, 1);
  f.sounds[0].complete();
  f.step();
  assert.equal(f.service.rooms.state?.buffering, false);
  assert.equal(f.audio.playing, false);
  f.step(1000);
  assert.equal(f.audio.playing, true);
  assert.deepEqual(f.sounds[0].volumes, [0.12]);
  assert.equal(f.service.telemetry?.playing, true);
  f.service.stop();
  assert.equal(f.service.rooms.joined, false);
  assert.equal(f.audio.playing, false);
  assert.equal(f.released(), 1);
  assert.equal(transport.disposed, true);
  assert.equal(f.transports.length, 2);
});

test('cancelled lookup and download callbacks cannot append tracks to a different group', () => {
  const f = fixture();
  f.service.create('First');
  f.service.add('song');
  f.step();
  const lookup = f.transports[0].jobs[0];
  f.service.create('Second');
  lookup.complete(resolved);
  assert.equal(f.service.rooms.state?.queue.length, 0);
  f.service.add('new song');
  f.step();
  f.transports[0].jobs.at(-1)!.complete(resolved);
  f.step();
  const download = f.transports[0].jobs.at(-1)!;
  f.service.leave();
  download.complete({ videoId: resolved.videoId, path: 'valid' });
  f.step();
  assert.equal(f.service.rooms.joined, false);
  assert.equal(f.sounds.length, 0);
});

test('stream failure retries once using complete preparation and removes an unavailable leader track', () => {
  const f = fixture(),
    transport = resolve(f);
  transport.jobs[1].failed('stream failed');
  f.step();
  assert.equal(transport.jobs[2].operation, 'prepare');
  transport.jobs[2].failed('conversion failed');
  assert.equal(f.service.rooms.state?.queue.length, 0);
  assert.equal(f.service.message, 'conversion failed');
  f.step();
  assert.equal(transport.jobs.length, 3);
});

test('volume survives temporary absence of the sound service and clock survives short scene changes', () => {
  const f = fixture();
  assert.equal(f.service.volume, 0.12);
  f.setVolume(null);
  assert.equal(f.service.volume, 0.12);
  f.setVolume(NaN);
  assert.equal(f.service.volume, 0.12);
  f.setVolume(3);
  assert.equal(f.service.volume, 1);
  f.service.create('Radio');
  f.setLeaving(true);
  f.step(59000);
  assert.equal(f.service.rooms.synchronized, true);
  f.step(1000);
  assert.equal(f.service.rooms.synchronized, false);
  f.setLeaving(false);
  f.step();
  assert.equal(f.service.rooms.synchronized, true);
});

test('lookup capacity counts queued and in-flight work and disposal releases timer/music', () => {
  const f = fixture();
  f.service.create('Radio');
  for (let i = 0; i < 9; i++) f.service.add('song ' + i);
  assert.match(f.service.message, /lookup queue is full/);
  f.step();
  assert.equal(f.transports[0].jobs.length, 1);
  f.service.dispose();
  assert.equal(f.timerStopped(), true);
  assert.equal(f.released(), 1);
  assert.equal(f.transports[0].disposed, true);
  assert.equal(f.service.telemetry, null);
  f.transports[0].jobs[0].complete(resolved);
  assert.equal(f.service.rooms.joined, false);
});
