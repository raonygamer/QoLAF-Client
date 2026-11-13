import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioReadiness } from '../src/radio/RadioReadiness';
import type { RadioState } from '../src/radio/RadioState';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';

const video = 'AbC_123-xyz';
function fixture(host = true) {
  const state: RadioState = {
    roomId: 'room',
    hostId: 'host',
    name: 'Radio',
    revision: 1,
    queueRevision: 1,
    queue: [{ videoId: video, title: 'Song', durationMs: 60000 }],
    playing: true,
    buffering: true,
    positionMs: 0,
    anchorAt: 0,
    playbackRevision: 3,
    currentIndex: 0,
    shuffle: false,
    repeatMode: 'off',
    keepFinished: false,
    playedMask: 0,
  };
  const sessions = new Map([['guest', 'guest-session']]);
  const packets: {
    target: string;
    message: IPCMessage;
    key: string;
    sent: () => void;
    isCurrent: () => boolean;
  }[] = [];
  let publications = 0,
    changes = 0;
  const owner = {
    state,
    host,
    synchronized: true,
    online: true,
    clockReady: true,
    transferringLeadership: false,
    elapsed: 100,
    serverNow: 5000,
    ownSession: host ? 'host-session' : 'guest-session',
    hostSession: 'host-session',
    members: new Map([['guest', { session: 'guest-session', seen: 100 }]]),
    peerSessionId: (id: string) => sessions.get(id) ?? null,
    changed: () => {
      changes++;
    },
    publish: () => {
      publications++;
    },
    queueReady: (
      target: string,
      message: IPCMessage,
      key: string,
      sent: () => void,
      isCurrent: () => boolean,
    ) => {
      packets.push({ target, message, key, sent, isCurrent });
    },
  };
  return {
    state,
    owner,
    sessions,
    packets,
    readiness: new RadioReadiness(owner),
    publications: () => publications,
    changes: () => changes,
  };
}
const ack = (playback = 3): IPCMessage => ({
  type: 'qipc3.radio.ready',
  fields: ['guest-session', 'room', 'host-session', playback, video],
});

test('leader captures a fixed cohort and eight-second deadline without extending repeated readiness', () => {
  const f = fixture();
  f.readiness.ready(video, 3);
  assert.equal(f.readiness.waitingCount, 1);
  assert.equal(f.readiness.waitingMs, 8000);
  f.owner.elapsed += 7000;
  f.readiness.ready(video, 3);
  assert.equal(f.readiness.waitingMs, 1000);
  f.owner.members.set('late', { session: 'late-session', seen: f.owner.elapsed });
  f.sessions.set('late', 'late-session');
  assert.equal(f.readiness.waitingCount, 1, 'late arrival cannot extend the captured cohort');
  f.state.playing = false;
  f.owner.elapsed += 1000;
  f.readiness.finish();
  assert.equal(f.state.buffering, false);
  assert.equal(f.state.playing, false);
  assert.equal(f.state.anchorAt, 6000);
  assert.equal(f.state.revision, 2);
  assert.equal(f.publications(), 1);
  f.readiness.finish();
  assert.equal(f.publications(), 1);
});

test('early valid acknowledgements count, but wrong sessions, playback and handoffs do not', () => {
  const f = fixture();
  assert.equal(f.readiness.receive(ack(2), 'guest'), false);
  f.owner.transferringLeadership = true;
  assert.equal(f.readiness.receive(ack(), 'guest'), false);
  f.owner.transferringLeadership = false;
  f.sessions.set('guest', 'new-session');
  assert.equal(f.readiness.receive(ack(), 'guest'), false);
  f.sessions.set('guest', 'guest-session');
  assert.equal(f.readiness.receive(ack(), 'guest'), true);
  assert.equal(f.publications(), 0, 'the leader itself must have buffered first');
  f.readiness.ready(video, 3);
  assert.equal(f.state.buffering, false);
  assert.equal(f.publications(), 1);
});

test('departed sessions stop blocking, but offline or missing shared clock cannot start playback', () => {
  const f = fixture();
  f.readiness.ready(video);
  f.sessions.delete('guest');
  f.owner.clockReady = false;
  f.readiness.finish();
  assert.equal(f.state.buffering, true);
  f.owner.clockReady = true;
  f.owner.online = false;
  f.readiness.finish();
  assert.equal(f.state.buffering, true);
  f.owner.online = true;
  f.readiness.finish();
  assert.equal(f.state.buffering, false);
});

test('guest acks retry once per second until delivered and stale completions cannot suppress a new playback', () => {
  const f = fixture(false);
  f.readiness.ready(video, 2);
  assert.equal(f.packets.length, 0);
  f.readiness.ready(video, 3);
  assert.deepEqual(f.packets[0].message, ack());
  assert.equal(f.packets[0].target, 'host');
  f.readiness.ready(video, 3);
  assert.equal(f.packets.length, 1);
  f.owner.elapsed += 1000;
  f.readiness.ready(video, 3);
  assert.equal(f.packets.length, 2);
  f.packets[1].sent();
  f.owner.elapsed += 1000;
  f.readiness.ready(video, 3);
  assert.equal(f.packets.length, 2);
  f.readiness.reset();
  f.state.playbackRevision = 4;
  f.packets[0].sent();
  assert.equal(f.packets[0].isCurrent(), false);
  f.readiness.ready(video, 4);
  assert.equal(f.packets.length, 3);
  f.state.buffering = false;
  assert.equal(f.packets[2].isCurrent(), false);
});
