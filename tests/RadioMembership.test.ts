import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioMembership, type RadioMembershipOwner } from '../src/radio/RadioMembership';
import type { RadioState } from '../src/radio/RadioState';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';

function fixture() {
  const state: RadioState = {
    roomId: 'room',
    hostId: 'host',
    name: 'Radio',
    revision: 1,
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
  const sessions = new Map([['guest', 'guest-session']]);
  const packets: IPCMessage[] = [],
    invalidated: string[] = [],
    snapshots: string[] = [],
    removed: string[] = [];
  let publications = 0,
    finished = 0;
  const owner: { -readonly [K in keyof RadioMembershipOwner]: RadioMembershipOwner[K] } = {
    state,
    online: true,
    closed: false,
    host: true,
    synchronized: true,
    transferringLeadership: false,
    ownId: 'host',
    ownSession: 'host-session',
    elapsed: 0,
    passwordProtected: false,
    peerSessionId: (id) => sessions.get(id) ?? null,
    verifyPassword: (_id, _session, proof) => proof === 'correct',
    invalidateRequests: (id) => {
      invalidated.push(id);
    },
    removeReadyPeer: (id) => {
      removed.push(id);
    },
    finishReadiness: () => {
      finished++;
    },
    publish: () => {
      publications++;
      state.revision++;
    },
    advertiseSoon: () => {},
    sendSnapshot: (id) => {
      snapshots.push(id);
    },
    status: () => {},
    queue: (_id, message) => {
      packets.push(message);
      return true;
    },
  };
  return {
    owner,
    state,
    sessions,
    packets,
    invalidated,
    snapshots,
    removed,
    publications: () => publications,
    finished: () => finished,
    membership: new RadioMembership(owner),
  };
}
function join(attempt = 'join-1', session = 'guest-session', proof = ''): IPCMessage {
  return {
    type: 'qipc3.radio.join',
    fields: [session, 'room', 'host-session', -1, true, proof, attempt],
  };
}

test('fresh joins allocate authority, repeat joins refresh presence, and new sessions revoke DJ', () => {
  const f = fixture();
  f.membership.receive(join(), 'guest', '  Name\nHere  ');
  assert.equal(f.membership.members.get('guest')?.name, 'Name Here');
  f.membership.setDJ('guest', 'guest-session', true);
  const authority = f.membership.members.get('guest')!.authority;
  assert.equal(f.membership.isDJ('guest'), true);
  f.owner.elapsed = 9999;
  f.membership.receive(join(), 'guest', 'changed');
  assert.equal(f.snapshots.length, 1);
  assert.equal(f.membership.members.get('guest')?.authority, authority);
  assert.equal(f.membership.members.get('guest')?.seen, 9999);
  f.owner.elapsed = 10000;
  f.sessions.set('guest', 'next-session');
  f.membership.receive(join('join-2', 'next-session'), 'guest', 'New name');
  assert.equal(f.membership.isDJ('guest'), false);
  assert.equal(f.membership.members.get('guest')!.authority, authority + 1);
  assert.deepEqual(f.snapshots, ['guest', 'guest']);
  assert.deepEqual(f.invalidated, ['guest', 'guest']);
});

test('kick rejects the old attempt but permits a new explicit join', () => {
  const f = fixture();
  f.membership.receive(join(), 'guest', 'Guest');
  assert.equal(f.membership.kickPeer('guest', 'guest-session'), true);
  assert.deepEqual(f.packets[0].fields, ['host-session', 'room', 'guest-session']);
  f.membership.receive(join(), 'guest', 'Guest');
  assert.equal(f.membership.members.size, 0);
  assert.deepEqual(f.packets.at(-1)?.fields, [
    'host-session',
    'room',
    'guest-session',
    'join-1',
    'kicked',
  ]);
  f.membership.receive(join('join-2'), 'guest', 'Guest');
  assert.equal(f.membership.members.size, 1);
  assert.deepEqual(f.removed, ['guest']);
});

test('password rejection is paced and legacy joins cannot bypass a protected room', () => {
  const f = fixture();
  f.owner.passwordProtected = true;
  const legacy = join();
  legacy.fields = legacy.fields.slice(0, 5);
  f.membership.receive(legacy, 'guest', 'Guest');
  assert.equal(f.packets.length, 0);
  f.membership.receive(join(), 'guest', 'Guest');
  f.membership.receive(join(), 'guest', 'Guest');
  assert.equal(f.packets.length, 1);
  assert.equal(f.packets[0].fields[4], 'password');
  f.owner.elapsed = 1000;
  f.membership.receive(join(), 'guest', 'Guest');
  assert.equal(f.packets.length, 2);
  f.membership.receive(join('join-1', 'guest-session', 'correct'), 'guest', 'Guest');
  assert.equal(f.membership.members.size, 1);
});

test('capacity rejects new identities while allowing an existing member to reconnect', () => {
  const f = fixture();
  for (let i = 0; i < 9; i++) {
    f.sessions.set('user-' + i, 'session-' + i);
    f.membership.receive(join('join-1', 'session-' + i), 'user-' + i, 'User ' + i);
  }
  assert.equal(f.membership.members.size, 8);
  assert.equal(f.packets.at(-1)?.fields[4], 'full');
  f.sessions.set('user-0', 'replacement');
  f.membership.receive(join('join-2', 'replacement'), 'user-0', 'Reconnected');
  assert.equal(f.membership.members.size, 8);
  assert.equal(f.membership.members.get('user-0')?.session, 'replacement');
});

test('authenticated departure clears readiness; presence expires strictly after 65 seconds', () => {
  const f = fixture();
  f.membership.receive(join(), 'guest', 'Guest');
  f.owner.elapsed = 65000;
  f.membership.expire();
  assert.equal(f.membership.members.size, 1);
  f.owner.elapsed++;
  f.membership.expire();
  assert.equal(f.membership.members.size, 0);
  f.membership.receive(join('join-2'), 'guest', 'Guest');
  const leave: IPCMessage = {
    type: 'qipc3.radio.leave',
    fields: ['stale-session', 'room', 'host-session'],
  };
  f.membership.receive(leave, 'guest', 'Guest');
  assert.equal(f.membership.members.size, 1);
  leave.fields[0] = 'guest-session';
  f.membership.receive(leave, 'guest', 'Guest');
  assert.equal(f.membership.members.size, 0);
  assert.equal(f.finished(), 1);
  assert.deepEqual(f.removed, ['guest']);
});

test('handoff blocks membership edits and clearing a room retains the authority sequence', () => {
  const f = fixture();
  f.membership.receive(join(), 'guest', 'Guest');
  const authority = f.membership.members.get('guest')!.authority;
  f.owner.transferringLeadership = true;
  f.membership.setDJ('guest', 'guest-session', true);
  assert.equal(f.membership.isDJ('guest'), false);
  assert.equal(f.membership.kickPeer('guest', 'guest-session'), false);
  f.membership.clear();
  f.membership.receive(join(), 'guest', 'Guest');
  assert.equal(f.membership.members.size, 0);
  f.owner.transferringLeadership = false;
  f.membership.receive(join(), 'guest', 'Guest');
  assert.equal(f.membership.members.get('guest')!.authority, authority + 1);
});

test('successor selection follows earliest DJ grant and promotion rebuilds roles without stale peers', () => {
  const f = fixture();
  f.membership.receive(join(), 'guest', 'Guest');
  f.membership.setDJ('guest', 'guest-session', true);
  assert.equal(f.membership.firstSuccessor()?.id, 'guest');
  f.sessions.set('host', 'host-session');
  f.owner.ownId = 'guest';
  const roster = f.membership.adoptLeader(
    [
      { id: 'host', session: 'host-session', name: 'Old host', role: 'host', authority: 0 },
      { id: 'guest', session: 'guest-session', name: 'Guest', role: 'dj', authority: 2 },
      { id: 'gone', session: 'gone-session', name: 'Gone', role: 'dj', authority: 9 },
    ],
    'host',
    'guest',
    true,
  );
  assert.deepEqual(
    roster.map((peer) => [peer.id, peer.role, peer.authority]),
    [
      ['host', 'dj', 10],
      ['guest', 'host', 2],
    ],
  );
  assert.equal(f.membership.members.size, 1);
  assert.equal(f.membership.firstSuccessor()?.id, 'host');
  const takeover = f.membership.adoptLeader(roster, 'host', 'guest', false);
  assert.equal(takeover.length, 1);
  assert.equal(f.membership.members.size, 0);
});
