import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioLeadership, type RadioLeadershipOwner } from '../src/radio/RadioLeadership';
import type { RadioState } from '../src/radio/RadioState';
import type { RadioMember } from '../src/radio/RadioMembership';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';

function fixture(host = true) {
  const state: RadioState = {
    roomId: 'room',
    hostId: 'host',
    name: 'Radio',
    revision: 3,
    queueRevision: 1,
    queue: [],
    playing: false,
    buffering: false,
    positionMs: 0,
    anchorAt: 0,
    playbackRevision: 0,
    currentIndex: 0,
    shuffle: false,
    repeatMode: 'off',
    keepFinished: false,
    playedMask: 0,
  };
  const sessions = new Map([
    ['host', 'host-session'],
    ['guest', 'guest-session'],
    ['observer', 'observer-session'],
  ]);
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
    events: string[] = [],
    adopted: unknown[][] = [];
  let nonce = 0;
  const owner: { -readonly [K in keyof RadioLeadershipOwner]: RadioLeadershipOwner[K] } = {
    state,
    host,
    synchronized: true,
    online: true,
    closed: false,
    clockReady: true,
    awaitingSnapshot: false,
    elapsed: 0,
    ownId: host ? 'host' : 'guest',
    ownSession: host ? 'host-session' : 'guest-session',
    hostSession: 'host-session',
    successorId: 'guest',
    successorSession: 'guest-session',
    members,
    peerSessionId: (id) => sessions.get(id) ?? null,
    nextNonce: () => ++nonce,
    sendSnapshot: () => {
      events.push('snapshot');
    },
    awaitSnapshot: () => {
      owner.awaitingSnapshot = true;
      owner.synchronized = false;
      events.push('await');
    },
    status: (text) => {
      events.push(text);
    },
    queue: (_target, message) => {
      packets.push(message);
      events.push(message.type);
      return true;
    },
    adoptLeader: (...args) => {
      adopted.push(args);
    },
  };
  return {
    owner,
    state,
    sessions,
    packets,
    events,
    adopted,
    leadership: new RadioLeadership(owner),
  };
}
const handoff: IPCMessage = {
  type: 'qipc3.radio.handoff',
  fields: ['host-session', 'room', 'guest-session', 3, 'host-session-leader-1'],
};
const ready: IPCMessage = {
  type: 'qipc3.radio.handoffReady',
  fields: ['guest-session', 'room', 'host-session', 3, 'host-session-leader-1'],
};
const leader: IPCMessage = {
  type: 'qipc3.radio.leader',
  fields: ['host-session', 'room', 'guest', 'guest-session', 3, 'host-session-leader-1'],
};

test('leader sends snapshot before offering and commits only once after exact acknowledgment', () => {
  const f = fixture();
  assert.equal(f.leadership.promoteLeader('guest', 'guest-session'), true);
  assert.deepEqual(f.packets[0], handoff);
  assert.deepEqual(f.events.slice(0, 2), ['snapshot', 'qipc3.radio.handoff']);
  assert.equal(f.leadership.promoteLeader('guest', 'guest-session'), false);
  const wrong = { ...ready, fields: [...ready.fields] };
  wrong.fields[4] = 'wrong';
  f.leadership.receive(wrong, 'guest');
  assert.equal(f.packets.length, 1);
  f.leadership.receive(ready, 'guest');
  f.leadership.receive(ready, 'guest');
  assert.equal(f.packets.length, 2);
  assert.deepEqual(f.packets[1], leader);
  assert.equal(f.leadership.pending?.committing, true);
  assert.deepEqual(f.adopted, []); // Sender adoption waits for the outbox completion callback.
});

test('recipient waits for the exact snapshot before acknowledging and accepting leadership', () => {
  const f = fixture(false);
  f.state.revision = 2;
  f.leadership.receive(leader, 'host');
  assert.equal(f.adopted.length, 0);
  f.leadership.receive(handoff, 'host');
  assert.equal(f.owner.awaitingSnapshot, true);
  assert.equal(f.packets.length, 0);
  f.state.revision = 3;
  f.owner.synchronized = true;
  f.owner.awaitingSnapshot = false;
  f.leadership.acknowledge();
  assert.deepEqual(f.packets[0], ready);
  f.leadership.receive(leader, 'host');
  assert.deepEqual(f.adopted, [['guest', 'guest-session', 3, true]]);
});

test('pending handoffs cancel at timeout, queue revision change or recipient session change', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.owner.elapsed = 15000;
    },
    (f: ReturnType<typeof fixture>) => {
      f.state.revision++;
    },
    (f: ReturnType<typeof fixture>) => {
      f.sessions.set('guest', 'new-session');
    },
  ]) {
    const f = fixture();
    f.leadership.promoteLeader('guest', 'guest-session');
    mutate(f);
    f.leadership.expire();
    assert.equal(f.leadership.pending, null);
    assert.match(f.events.at(-1)!, /still the leader/);
    f.leadership.receive(ready, 'guest');
    assert.equal(f.packets.length, 1);
  }
});

test('failed commit retains the old leader and expired offers cannot be accepted', () => {
  const f = fixture();
  f.leadership.promoteLeader('guest', 'guest-session');
  f.owner.queue = () => false;
  f.leadership.receive(ready, 'guest');
  assert.equal(f.leadership.pending, null);
  assert.deepEqual(f.adopted, []);
  const guest = fixture(false);
  guest.leadership.receive(handoff, 'host');
  guest.owner.elapsed = 15001;
  guest.leadership.receive(leader, 'host');
  assert.deepEqual(guest.adopted, []);
});

test('only the designated synchronized successor can take over an absent leader', () => {
  const f = fixture(false);
  assert.equal(f.leadership.trySuccession(), false);
  f.sessions.delete('host');
  f.owner.clockReady = false;
  assert.equal(f.leadership.trySuccession(), false);
  f.owner.clockReady = true;
  f.owner.awaitingSnapshot = true;
  assert.equal(f.leadership.trySuccession(), false);
  f.owner.awaitingSnapshot = false;
  f.owner.adoptLeader = (...args) => {
    f.adopted.push(args);
    f.leadership.clear();
  };
  assert.equal(f.leadership.trySuccession(), true);
  assert.deepEqual(f.adopted, [['guest', 'guest-session', 3, false]]);
  assert.deepEqual(f.leadership.proof, {
    type: 'qipc3.radio.takeover',
    fields: ['guest-session', 'room', 'host', 'host-session', 3, ''],
  });
  assert.deepEqual(f.packets[0], f.leadership.proof);
});

test('observers require the delegated successor identity and disappearance of the former host', () => {
  const f = fixture(false);
  f.owner.ownId = 'observer';
  f.owner.ownSession = 'observer-session';
  const takeover: IPCMessage = {
    type: 'qipc3.radio.takeover',
    fields: ['guest-session', 'room', 'host', 'host-session', 3, ''],
  };
  f.leadership.receive(takeover, 'guest');
  assert.equal(f.adopted.length, 0);
  f.sessions.delete('host');
  f.owner.successorSession = 'obsolete';
  f.leadership.receive(takeover, 'guest');
  assert.equal(f.adopted.length, 0);
  f.owner.successorSession = 'guest-session';
  f.leadership.receive(takeover, 'guest');
  assert.deepEqual(f.adopted, [['guest', 'guest-session', 3, false]]);
});
