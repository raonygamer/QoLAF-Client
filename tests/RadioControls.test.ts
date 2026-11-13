import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RadioControls,
  type RadioControlsOwner,
  type RadioControlOutcome,
} from '../src/radio/RadioControls';
import { RadioQueue } from '../src/radio/RadioQueue';
import type { RadioState } from '../src/radio/RadioState';
import type { RadioMember } from '../src/radio/RadioMembership';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';

function fixture(host = true) {
  const state: RadioState = {
    roomId: 'room',
    hostId: 'host',
    name: 'Radio',
    revision: 1,
    queueRevision: 1,
    queue: [{ videoId: 'AbC_123-xyz', title: 'Track', durationMs: 10000 }],
    playing: true,
    buffering: false,
    positionMs: 100,
    anchorAt: 1000,
    playbackRevision: 1,
    currentIndex: 0,
    shuffle: false,
    repeatMode: 'off',
    keepFinished: false,
    playedMask: 0,
  };
  const members = new Map<string, RadioMember>([
    [
      'guest',
      {
        session: 'guest-session',
        seen: 0,
        name: 'Guest',
        dj: true,
        authority: 2,
        lastControl: 0,
        joinAttempt: 'join-1',
      },
    ],
  ]);
  const packets: IPCMessage[] = [],
    notices: RadioControlOutcome[] = [],
    snapshots: string[] = [];
  let nonce = 0,
    publishes = 0;
  const owner: { -readonly [K in keyof RadioControlsOwner]: RadioControlsOwner[K] } = {
    state,
    host,
    controller: true,
    synchronized: true,
    online: true,
    closed: false,
    transferringLeadership: false,
    ownAuthority: 2,
    ownSession: host ? 'host-session' : 'guest-session',
    hostSession: 'host-session',
    elapsed: 0,
    serverNow: 2000,
    members,
    peerSessionId: (id) => (id === 'host' ? 'host-session' : (members.get(id)?.session ?? null)),
    isDJ: (id) => members.get(id)?.dj === true,
    nextNonce: () => ++nonce,
    queue: (_target, message) => {
      packets.push(message);
      return true;
    },
    sendSnapshot: (id) => {
      snapshots.push(id);
    },
    onControlResult: (outcome) => {
      notices.push(outcome);
    },
  };
  const queue = new RadioQueue({
    get state() {
      return owner.state;
    },
    get host() {
      return owner.host;
    },
    get online() {
      return owner.online;
    },
    get synchronized() {
      return owner.synchronized;
    },
    get transferringLeadership() {
      return owner.transferringLeadership;
    },
    get serverNow() {
      return owner.serverNow;
    },
    resetReadiness: () => {},
    publish: () => {
      publishes++;
    },
  });
  return {
    state,
    owner,
    members,
    packets,
    notices,
    snapshots,
    publishes: () => publishes,
    controls: new RadioControls(owner, queue),
  };
}
function command(action = 'pause'): IPCMessage {
  return {
    type: 'qipc3.radio.control',
    fields: ['guest-session', 'room', 'host-session', 2, 1, 1, action, 0, false, false, 7000],
  };
}

test('leader applies a DJ operation through the real queue and rejects duplicate commands', () => {
  const f = fixture();
  f.controls.receive(command(), 'guest');
  assert.equal(f.state.playing, false);
  assert.equal(f.state.positionMs, 1100);
  assert.equal(f.state.revision, 2);
  assert.equal(f.publishes(), 1);
  assert.equal(f.packets[0].fields[4], 'applied');
  f.controls.receive(command(), 'guest');
  assert.equal(f.publishes(), 1);
  assert.equal(f.packets[1].fields[4], 'stale');
  assert.deepEqual(f.snapshots, ['guest']);
});

test('stale revisions, expired commands and revoked authority never mutate playback', () => {
  for (const edit of [
    (p: IPCMessage) => {
      p.fields[5] = 0;
    },
    (p: IPCMessage) => {
      p.fields[10] = 1999;
    },
    (p: IPCMessage) => {
      p.fields[10] = 12001;
    },
    (p: IPCMessage) => {
      p.fields[3] = 3;
    },
  ]) {
    const f = fixture(),
      p = command();
    edit(p);
    f.controls.receive(p, 'guest');
    assert.equal(f.state.playing, true);
    assert.equal(f.publishes(), 0);
    assert.equal(f.snapshots.length, 1);
  }
  const f = fixture();
  f.members.get('guest')!.dj = false;
  f.controls.receive(command(), 'guest');
  assert.equal(f.packets[0].fields[4], 'denied');
});

test('DJ requests leave local state untouched and results match the pending identity', () => {
  const f = fixture(false);
  assert.equal(f.controls.control('pause'), true);
  assert.deepEqual(f.packets[0], command());
  assert.equal(f.state.playing, true);
  assert.equal(f.controls.control('next'), false);
  assert.deepEqual(f.notices, ['waiting']);
  const result: IPCMessage = {
    type: 'qipc3.radio.controlResult',
    fields: ['host-session', 'room', 'guest-session', 2, 'applied'],
  };
  f.controls.receive(result, 'host');
  assert.ok(f.controls.pending);
  result.fields[3] = 1;
  f.controls.receive(result, 'host');
  assert.equal(f.controls.pending, null);
  assert.deepEqual(f.notices, ['waiting', 'applied']);
  assert.equal(f.state.playing, true);
});

test('pending controls time out after five seconds and queue rejection releases them immediately', () => {
  const f = fixture(false);
  f.controls.control('pause');
  f.owner.elapsed = 4999;
  f.controls.expire();
  assert.ok(f.controls.pending);
  f.owner.elapsed++;
  f.controls.expire();
  assert.equal(f.controls.pending, null);
  assert.deepEqual(f.notices, ['failed']);
  f.owner.queue = () => false;
  assert.equal(f.controls.control('pause'), false);
  assert.equal(f.controls.pending, null);
  assert.deepEqual(f.notices, ['failed', 'failed']);
});

test('local leader controls use original queue modes and reject invalid values', () => {
  const f = fixture();
  assert.equal(f.controls.control('seek', NaN), false);
  assert.equal(f.controls.control('play', 0.5), false);
  assert.equal(f.controls.control('remove', 1), false);
  assert.equal(f.controls.control('modes', true, 'invalid', true), false);
  assert.equal(f.controls.control('modes', true, 'all', false), true);
  assert.equal(f.state.shuffle, true);
  assert.equal(f.state.repeatMode, 'all');
  assert.equal(f.state.keepFinished, true);
  assert.equal(f.packets.length, 0);
});
