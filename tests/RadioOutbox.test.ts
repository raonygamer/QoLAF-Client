import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RadioOutbox,
  type RadioOutboxOwner,
  type RadioPacketTransport,
} from '../src/radio/RadioOutbox';
import {
  RadioRequests,
  type RadioRequestOwner,
  type RadioRequestOutcome,
} from '../src/radio/RadioRequests';
import type { IPCSendCallbacks } from '../src/ipc/ClientIPCQueue';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';
import type { RadioState } from '../src/radio/RadioState';

function fixture() {
  const sent: { message: IPCMessage; callbacks: IPCSendCallbacks }[] = [];
  const sessions = new Map([
    ['guest', 'guest-session'],
    ['host', 'host-session'],
  ]);
  const transport: RadioPacketTransport = {
    peerSessionId: (id) => sessions.get(id) ?? null,
    send: (_target, message, callbacks) => {
      sent.push({ message, callbacks });
      return true;
    },
    broadcast: (message, callbacks) => {
      sent.push({ message, callbacks });
      return true;
    },
  };
  const state: RadioState = {
    roomId: 'room',
    hostId: 'host',
    name: 'Radio',
    revision: 1,
    queueRevision: 0,
    queue: [],
    playing: false,
    buffering: true,
    positionMs: 0,
    anchorAt: 0,
    playbackRevision: 3,
    currentIndex: -1,
    shuffle: false,
    repeatMode: 'off',
    keepFinished: false,
    playedMask: 0,
  };
  const abandoned: string[] = [],
    ready: number[] = [];
  let cancellations = 0;
  const owner: RadioOutboxOwner = {
    transport,
    state,
    online: true,
    closed: false,
    host: true,
    controller: true,
    ownAuthority: 0,
    elapsed: 0,
    ownSession: 'host-session',
    hostSession: 'host-session',
    joinAttempt: 'join-1',
    handoffPending: null,
    handoffOffer: null,
    controlPending: null,
    members: new Map([['guest', { session: 'guest-session' }]]),
    hasOutstandingRequest: () => true,
    abandonRequest: (id) => {
      abandoned.push(id);
    },
    snapshotMessage: () => ({ type: 'qipc3.radio.state', fields: [state.revision] }),
    timelineMessage: () => ({ type: 'qipc3.radio.timeline', fields: [state.revision] }),
    adoptLeader: () => {},
    readySent: (playback) => {
      ready.push(playback);
    },
    cancelHandoff: () => {
      cancellations++;
    },
  };
  // Mutable session state is owned by RadioRooms in production.
  const mutable = owner as { -readonly [K in keyof RadioOutboxOwner]: RadioOutboxOwner[K] };
  return {
    owner: mutable,
    state,
    sessions,
    sent,
    abandoned,
    ready,
    cancellations: () => cancellations,
    outbox: new RadioOutbox(owner),
  };
}
const packet: IPCMessage = { type: 'qipc3.radio.discover', fields: [] };
const request: IPCMessage = {
  type: 'qipc3.radio.request',
  fields: ['host-session', 'room', 'host-session', 'song', 'id-1'],
};

test('state payload is refreshed at transmission and again if revision advances in flight', () => {
  const f = fixture();
  f.outbox.queue('guest', packet, 'state:guest', true, 'state');
  f.outbox.flush();
  f.state.revision = 5;
  assert.deepEqual(f.sent[0].callbacks.beforeSend!()?.fields, [5]);
  f.state.revision = 6;
  f.sent[0].callbacks.onSent!();
  f.owner.elapsed = 199;
  f.outbox.flush();
  assert.equal(f.sent.length, 1);
  f.owner.elapsed = 200;
  f.outbox.flush();
  assert.deepEqual(f.sent[1].callbacks.beforeSend!()?.fields, [6]);
  f.sessions.set('guest', 'new-session');
  assert.equal(f.sent[1].callbacks.beforeSend!(), null);
});

test('requests retry without extending the deadline and stale attempt callbacks have no effect', () => {
  const f = fixture();
  f.outbox.queue('guest', request, 'request:id-1', true, 'request');
  f.outbox.flush();
  f.sent[0].callbacks.onError!('transient');
  f.owner.elapsed = 200;
  f.outbox.flush();
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[0].callbacks.beforeSend!(), null);
  f.sent[0].callbacks.onSent!();
  assert.deepEqual(f.sent[1].callbacks.beforeSend!(), request);
  f.sent[1].callbacks.onError!('transient');
  f.owner.elapsed = 15000;
  f.outbox.flush();
  assert.deepEqual(f.abandoned, ['id-1']);
  assert.equal(f.sent.length, 2);
});

test('ready packets preempt request retries, but changed playback cannot acknowledge readiness', () => {
  const f = fixture();
  f.outbox.queue('guest', request, 'request:id-1', true, 'request');
  f.outbox.flush();
  f.sent[0].callbacks.onError!('transient');
  f.outbox.queue('guest', packet, 'ready', true, 'ready');
  f.owner.elapsed = 200;
  f.outbox.flush();
  assert.equal(f.sent[1].message, packet);
  f.state.playbackRevision++;
  f.sent[1].callbacks.onSent!();
  assert.deepEqual(f.ready, []);
  f.owner.elapsed = 400;
  f.outbox.flush();
  assert.equal(f.sent[2].message, request);
});

test('coalescing retains the original lifetime and room/session changes invalidate queued work', () => {
  const f = fixture();
  for (let i = 0; i < 24; i++) assert.equal(f.outbox.queue(null, packet, String(i)), true);
  assert.equal(f.outbox.queue(null, packet, 'overflow'), false);
  f.owner.elapsed = 14999;
  assert.equal(f.outbox.queue(null, packet, '0'), true);
  f.owner.elapsed = 15000;
  f.outbox.flush();
  assert.equal(f.sent.length, 0);
  f.outbox.clear();
  f.outbox.queue('guest', packet, 'state', true, 'state');
  f.state.roomId = 'new-room';
  f.outbox.flush();
  assert.equal(f.sent.length, 0);
  f.outbox.queue(null, packet, 'discover');
  f.owner.ownSession = 'new-session';
  f.outbox.flush();
  assert.equal(f.sent.length, 0);
});

test('request ledger and outbox preserve delivery proof through a late send failure', () => {
  const f = fixture();
  f.owner.host = false;
  f.owner.ownSession = 'guest-session';
  const results: RadioRequestOutcome[] = [];
  const requestOwner: RadioRequestOwner = {
    get state() {
      return f.state;
    },
    get elapsed() {
      return f.owner.elapsed;
    },
    host: false,
    online: true,
    synchronized: true,
    transferringLeadership: false,
    ownId: 'guest',
    ownSession: 'guest-session',
    hostSession: 'host-session',
    members: new Map(),
    peerSessionId: (id) => f.sessions.get(id) ?? null,
    status: () => {},
    onTrackRequest: () => true,
    onRequestResult: (_id, outcome) => {
      results.push(outcome);
    },
    queue: (target, message, key, kind) => f.outbox.queue(target, message, key, true, kind),
  };
  const requests = new RadioRequests(requestOwner);
  f.owner.hasOutstandingRequest = (id) => requests.hasOutstanding(id);
  f.owner.abandonRequest = (id) => requests.abandon(id);
  assert.equal(requests.requestTrack('song'), true);
  f.outbox.flush();
  assert.ok(f.sent[0].callbacks.beforeSend!());
  requests.receive(
    {
      type: 'qipc3.radio.requestResult',
      fields: ['host-session', 'room', 'guest-session', 'guest-session-1', 'pending'],
    },
    'host',
  );
  f.owner.elapsed = 15000;
  f.sent[0].callbacks.onError!('late failure');
  assert.equal(requests.hasOutstanding('guest-session-1'), true);
  assert.deepEqual(results, ['pending']);
  f.owner.elapsed = 150000;
  requests.expire();
  assert.deepEqual(results, ['pending', 'expired']);
});

test('handoff transmission requires the exact offered revision and failures cancel the transfer', () => {
  const f = fixture();
  f.owner.handoffPending = { deadline: 10000, revision: 1 };
  const adopted: unknown[][] = [];
  f.owner.adoptLeader = (...args) => {
    adopted.push(args);
  };
  const leader: IPCMessage = {
    type: 'qipc3.radio.leader',
    fields: ['host-session', 'room', 'guest', 'guest-session', 2],
  };
  f.outbox.queue('guest', leader, 'leader', true, 'leader');
  f.outbox.flush();
  f.state.revision = 2;
  assert.equal(f.sent[0].callbacks.beforeSend!(), null);
  f.sent[0].callbacks.onError!('superseded');
  assert.equal(f.cancellations(), 1);
  assert.deepEqual(adopted, []);
  f.owner.handoffPending = { deadline: 10000, revision: 2 };
  f.outbox.queue('guest', leader, 'leader', true, 'leader');
  f.owner.elapsed = 200;
  f.outbox.flush();
  assert.equal(f.sent[1].callbacks.beforeSend!(), leader);
  f.sent[1].callbacks.onSent!();
  assert.deepEqual(adopted, [['guest', 'guest-session', 2, true]]);
});

test('transport replacement and clearing invalidate deferred preparation and completion', () => {
  const f = fixture();
  f.outbox.queue('guest', request, 'request:id-1', true, 'request');
  f.outbox.flush();
  f.owner.transport = { ...f.owner.transport! };
  assert.equal(f.sent[0].callbacks.beforeSend!(), null);
  f.outbox.clear(true);
  f.sent[0].callbacks.onSent!();
  f.sent[0].callbacks.onError!('disposed');
  assert.deepEqual(f.abandoned, ['id-1']);
  f.owner.elapsed = 200;
  f.outbox.flush();
  assert.equal(f.sent.length, 1);
});

test('join attempts and DJ authority are rechecked when IPC prepares the packet', () => {
  const f = fixture();
  const join: IPCMessage = {
    type: 'qipc3.radio.join',
    fields: ['host-session', 'room', 'host-session', 0, false, '', 'join-1'],
  };
  f.outbox.queue('guest', join, 'join', true, 'join');
  f.outbox.flush();
  f.owner.joinAttempt = 'join-2';
  assert.equal(f.sent[0].callbacks.beforeSend!(), null);
  f.outbox.clear();
  f.owner.controlPending = { id: 7 };
  f.owner.ownAuthority = 4;
  const control: IPCMessage = {
    type: 'qipc3.radio.control',
    fields: ['host-session', 'room', 'host-session', 4, 7, 'pause'],
  };
  f.outbox.queue('guest', control, 'control', true, 'control');
  f.owner.elapsed = 200;
  f.outbox.flush();
  assert.equal(f.sent[1].callbacks.beforeSend!(), control);
  f.owner.ownAuthority = 5;
  assert.equal(f.sent[1].callbacks.beforeSend!(), null);
});
