import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RadioRequests,
  type RadioRequestOwner,
  type RadioRequestOutcome,
} from '../src/radio/RadioRequests';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';
import type { RadioState } from '../src/radio/RadioState';

function fixture(host = false) {
  const packets: IPCMessage[] = [];
  const results: RadioRequestOutcome[] = [];
  const admitted: string[] = [];
  const sessions = new Map([
    ['host', 'host-session'],
    ['guest', 'guest-session'],
  ]);
  const state: RadioState = {
    roomId: 'room',
    hostId: 'host',
    name: 'Radio',
    revision: 0,
    queueRevision: 0,
    queue: [],
    playing: false,
    buffering: false,
    positionMs: 0,
    anchorAt: 0,
    playbackRevision: 0,
    currentIndex: -1,
    shuffle: false,
    repeatMode: 'off',
    keepFinished: false,
    playedMask: 0,
  };
  const owner = {
    state,
    host,
    online: true,
    synchronized: true,
    transferringLeadership: false as boolean,
    elapsed: 0,
    ownId: host ? 'host' : 'guest',
    ownSession: host ? 'host-session' : 'guest-session',
    hostSession: 'host-session',
    members: new Map([['guest', { session: 'guest-session', seen: 0 }]]),
    peerSessionId: (id: string) => sessions.get(id) ?? null,
    status: (_message: string) => {},
    onTrackRequest: (query: string) => {
      admitted.push(query);
      return true;
    },
    onRequestResult: (_id: string, outcome: RadioRequestOutcome) => {
      results.push(outcome);
    },
    queue: (_target: string, message: IPCMessage) => {
      packets.push(message);
      return true;
    },
  } satisfies RadioRequestOwner;
  return { owner, packets, results, admitted, sessions, requests: new RadioRequests(owner) };
}
function request(id = 'request-1'): IPCMessage {
  return {
    type: 'qipc3.radio.request',
    fields: ['guest-session', 'room', 'host-session', 'song', id],
  };
}
function result(id: string, outcome: RadioRequestOutcome): IPCMessage {
  return {
    type: 'qipc3.radio.requestResult',
    fields: ['host-session', 'room', 'guest-session', id, outcome],
  };
}

test('guest requests retain their initial lifetime across duplicate pending results', () => {
  const f = fixture();
  assert.equal(f.requests.requestTrack('  a\nsong  '), true);
  assert.deepEqual(f.packets[0].fields, [
    'guest-session',
    'room',
    'host-session',
    'a song',
    'guest-session-1',
  ]);
  assert.equal(f.requests.requestTrack('another'), false);
  f.owner.elapsed = 149999;
  f.requests.receive(result('guest-session-1', 'pending'), 'host');
  f.requests.receive(result('guest-session-1', 'pending'), 'host');
  f.requests.abandon('guest-session-1');
  assert.equal(f.requests.hasOutstanding('guest-session-1'), true);
  assert.deepEqual(f.results, ['pending']);
  f.owner.elapsed++;
  f.requests.expire();
  assert.deepEqual(f.results, ['pending', 'expired']);
  assert.equal(f.requests.hasOutstanding('guest-session-1'), false);
});

test('results from an obsolete host session cannot complete a request', () => {
  const f = fixture();
  f.requests.requestTrack('song');
  f.sessions.set('host', 'new-session');
  f.requests.receive(result('guest-session-1', 'accepted'), 'host');
  assert.deepEqual(f.results, []);
  f.sessions.set('host', 'host-session');
  f.requests.receive(result('guest-session-1', 'accepted'), 'host');
  f.requests.receive(result('guest-session-1', 'accepted'), 'host');
  assert.deepEqual(f.results, ['accepted']);
});

test('departed members retain expired tombstones and terminal decisions cannot change', () => {
  const f = fixture(true);
  f.requests.receive(request(), 'guest');
  assert.equal(f.requests.isPending('guest', 'request-1'), true);
  f.requests.invalidateMember('guest');
  assert.equal(f.requests.isPending('guest', 'request-1'), false);
  f.owner.elapsed = 10000;
  f.requests.receive(request(), 'guest');
  assert.deepEqual(f.admitted, ['song']);
  assert.equal(f.packets.at(-1)?.fields[4], 'expired');
  assert.equal(f.requests.respond('guest', 'request-1', 'accepted'), false);
  f.requests.receive(request('request-2'), 'guest');
  assert.equal(f.requests.respond('guest', 'request-2', 'accepted'), true);
  f.requests.invalidateMember('guest');
  f.requests.receive(request('request-2'), 'guest');
  assert.equal(f.packets.at(-1)?.fields[4], 'accepted');
});

test('room departure resets admission limits but a request-ledger reset does not', () => {
  const f = fixture(true);
  f.requests.receive(request(), 'guest');
  f.requests.clear();
  f.requests.receive(request('request-2'), 'guest');
  assert.equal(f.packets.at(-1)?.fields[4], 'rejected');
  assert.equal(f.admitted.length, 1);
  f.requests.clearRoom();
  f.requests.receive(request('request-3'), 'guest');
  assert.equal(f.admitted.length, 2);
  f.owner.transferringLeadership = true;
  f.requests.receive(request('request-4'), 'guest');
  assert.equal(f.admitted.length, 2);
});
