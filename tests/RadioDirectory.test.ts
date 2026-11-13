import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioDirectory, type RadioDirectoryOwner } from '../src/radio/RadioDirectory';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';
import type { RadioState } from '../src/radio/RadioState';

function fixture() {
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
    currentIndex: 0,
    shuffle: false,
    repeatMode: 'off',
    keepFinished: false,
    playedMask: 0,
  };
  const sessions = new Map([
    ['host', 'host-session'],
    ['guest', 'guest-session'],
  ]);
  const sent: { target: string | null; message: IPCMessage }[] = [],
    cleared: string[] = [];
  let changes = 0;
  const owner: { -readonly [K in keyof RadioDirectoryOwner]: RadioDirectoryOwner[K] } = {
    state,
    host: true,
    online: true,
    closed: false,
    elapsed: 0,
    ownSession: 'host-session',
    hostSession: 'host-session',
    memberCount: 2,
    passwordProtected: false,
    leadershipProof: null,
    peerSessionId: (id) => sessions.get(id) ?? null,
    changed: () => {
      changes++;
    },
    clearRoom: (reason) => {
      cleared.push(reason);
    },
    queue: (target, message) => {
      sent.push({ target, message });
      return true;
    },
  };
  return {
    owner,
    state,
    sessions,
    sent,
    cleared,
    changes: () => changes,
    directory: new RadioDirectory(owner),
  };
}
function advertisement(session = 'host-session'): IPCMessage {
  return { type: 'qipc3.radio.advertise', fields: [session, 'room', 'Radio', 3, true] };
}

test('authenticated advertisements accept both original schemas and expose detached listings', () => {
  const f = fixture();
  f.directory.receive(advertisement('old-session'), 'host', 'Leader');
  assert.equal(f.directory.rooms.length, 0);
  f.directory.receive(advertisement(), 'host', 'Leader');
  assert.deepEqual(f.directory.rooms, [
    {
      hostId: 'host',
      hostName: 'Leader',
      roomId: 'room',
      name: 'Radio',
      count: 3,
      passwordProtected: true,
    },
  ]);
  f.directory.rooms[0].name = 'mutated';
  assert.equal(f.directory.rooms[0].name, 'Radio');
  const legacy = advertisement();
  legacy.fields.pop();
  f.directory.receive(legacy, 'host', 'Leader');
  assert.equal(f.directory.rooms[0].passwordProtected, false);
  for (const fields of [
    ['host-session', 'room', 'Radio', 0],
    ['host-session', 'room', 'Radio', 10],
    ['host-session', 'room', 'Radio', 1.5],
    ['host-session', 'room', 'Radio', 3, 'true'],
    ['host-session', 'room', 'Bad\nname', 3],
  ]) {
    f.directory.receive({ type: 'qipc3.radio.advertise', fields }, 'host', 'Invalid');
  }
  assert.equal(f.changes(), 2);
});

test('directory cap permits updates while expiry checks both age and authenticated session', () => {
  const f = fixture();
  for (let i = 0; i < 65; i++) {
    f.sessions.set('host-' + i, 'session-' + i);
    f.directory.receive(advertisement('session-' + i), 'host-' + i, 'Leader');
  }
  assert.equal(f.directory.rooms.length, 64);
  f.directory.receive(advertisement('session-0'), 'host-0', 'Updated');
  assert.equal(f.directory.get('host-0')?.hostName, 'Updated');
  f.owner.elapsed = 65000;
  f.directory.expire();
  assert.equal(f.directory.rooms.length, 64);
  f.sessions.set('host-0', 'new-session');
  f.directory.expire();
  assert.equal(f.directory.rooms.length, 63);
  f.owner.elapsed++;
  assert.equal(f.directory.rooms.length, 0);
  f.directory.expire();
  assert.equal(f.directory.get('host-1'), undefined);
});

test('discovery and broadcasts retain 20-second pacing; replies have a separate 10-second limit', () => {
  const f = fixture();
  f.directory.refresh();
  f.directory.refresh();
  assert.equal(f.sent.length, 1);
  f.directory.advertiseIfDue();
  assert.deepEqual(f.sent[1].message.fields, ['host-session', 'room', 'Radio', 3, false]);
  f.owner.elapsed = 1000;
  const discover: IPCMessage = { type: 'qipc3.radio.discover', fields: ['guest-session'] };
  f.directory.receive(discover, 'guest', 'Guest');
  f.directory.receive(discover, 'guest', 'Guest');
  assert.equal(f.sent.length, 3);
  assert.equal(f.sent[2].target, 'guest');
  f.owner.elapsed = 11000;
  f.directory.receive(discover, 'guest', 'Guest');
  assert.equal(f.sent.length, 4);
  f.directory.advertiseIfDue();
  assert.equal(f.sent.length, 4);
  f.owner.elapsed = 20000;
  f.directory.refresh();
  f.directory.advertiseIfDue();
  assert.equal(f.sent.length, 6);
  assert.equal(f.sent[5].target, null);
});

test('leader close is authenticated and applies only to the matching room', () => {
  const f = fixture();
  f.owner.host = false;
  f.directory.receive(advertisement(), 'host', 'Leader');
  f.directory.receive(
    { type: 'qipc3.radio.close', fields: ['old-session', 'room'] },
    'host',
    'Leader',
  );
  f.directory.receive(
    { type: 'qipc3.radio.close', fields: ['host-session', 'other-room'] },
    'host',
    'Leader',
  );
  assert.equal(f.cleared.length, 0);
  assert.equal(f.directory.rooms.length, 1);
  f.directory.receive(
    { type: 'qipc3.radio.close', fields: ['host-session', 'room'] },
    'host',
    'Leader',
  );
  assert.deepEqual(f.cleared, ['The leader closed the radio room.']);
  assert.equal(f.directory.rooms.length, 0);
});

test('new leader proof precedes advertising and explicit refresh can advance the advertisement', () => {
  const f = fixture();
  f.owner.leadershipProof = { type: 'qipc3.radio.takeover', fields: ['host-session'] };
  f.directory.advertiseIfDue();
  assert.deepEqual(
    f.sent.map((entry) => entry.message.type),
    ['qipc3.radio.takeover', 'qipc3.radio.advertise'],
  );
  f.owner.elapsed = 200;
  f.directory.advertiseSoon();
  f.directory.advertiseIfDue();
  assert.equal(f.sent.length, 4);
  f.owner.closed = true;
  f.directory.receive(advertisement(), 'host', 'Leader');
  assert.equal(f.directory.rooms.length, 0);
});
