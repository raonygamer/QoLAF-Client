import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioStateWire, type RadioStateContext } from '../src/radio/RadioStateWire';
import type { RadioPeer, RadioState } from '../src/radio/RadioState';
import type { IPCMessage } from '../src/ipc/ClientIPCCodec';

const state: RadioState = {
  roomId: 'room',
  hostId: 'leader',
  name: 'My radio',
  revision: 7,
  queueRevision: 2,
  queue: [{ videoId: 'AbC_123-xyz', title: 'Song', durationMs: 100000 }],
  playing: true,
  buffering: false,
  positionMs: 1000,
  anchorAt: 5000,
  playbackRevision: 3,
  currentIndex: 0,
  shuffle: true,
  repeatMode: 'all',
  keepFinished: true,
  playedMask: 1,
};
const peers: RadioPeer[] = [
  { id: 'leader', session: 'host-session', name: 'Host', role: 'host', authority: 0 },
  { id: 'dj', session: 'dj-session', name: 'DJ', role: 'dj', authority: 4 },
];
const context = (): RadioStateContext => ({
  current: { ...state, revision: 6, playbackRevision: 2 },
  host: false,
  hostSession: 'host-session',
  minimumRevision: 6,
  awaitingSnapshot: false,
});
const full = () => RadioStateWire.encode(state, 'host-session', peers, peers[1], true);

test('radio v3 snapshot preserves exact primitive wire order, roster and leader designation', () => {
  const packet = full();
  assert.deepEqual(packet.fields, [
    'host-session',
    'room',
    7,
    2,
    true,
    false,
    1000,
    5000,
    3,
    'My radio',
    1,
    'AbC_123-xyz',
    'Song',
    100000,
    3,
    0,
    true,
    'all',
    true,
    1,
    'dj',
    'dj-session',
    2,
    'leader',
    'host-session',
    'Host',
    'host',
    0,
    'dj',
    'dj-session',
    'DJ',
    'dj',
    4,
  ]);
  const result = RadioStateWire.decode(packet, 'leader', context());
  assert.equal(result?.kind, 'state');
  if (result?.kind !== 'state') return assert.fail();
  assert.deepEqual(result.state, state);
  assert.deepEqual(result.roster, peers);
  assert.equal(result.successorSession, 'dj-session');
  assert.equal(result.resetReadiness, true);
});

test('radio legacy snapshots and all queue-option extensions retain their source defaults', () => {
  const base = full().fields.slice(0, 14);
  const decode = (fields: IPCMessage['fields']) =>
    RadioStateWire.decode({ type: 'qipc3.radio.state', fields }, 'leader', context());
  const legacy = decode(base);
  assert.equal(legacy?.kind, 'state');
  if (legacy?.kind !== 'state') return assert.fail();
  assert.deepEqual(
    [
      legacy.state.shuffle,
      legacy.state.repeatMode,
      legacy.state.keepFinished,
      legacy.state.playedMask,
      legacy.roster.length,
    ],
    [false, 'off', false, 0, 0],
  );
  const v1 = decode([...base, 1, 0, false, 'one', false, 0]);
  assert.equal(v1?.kind, 'state');
  const v2 = decode([...base, 2, 0, false, 'off', false, 0, ...full().fields.slice(22)]);
  assert.equal(v2?.kind, 'state');
  assert.equal(decode([...base, 1, 0, false, 'off', false, 0, 'extra']), null);
});

test('timeline revision gates request a snapshot without applying mismatched queues', () => {
  const packet = RadioStateWire.encode(state, 'host-session', peers, null, false);
  const ctx = context();
  assert.equal(RadioStateWire.decode(packet, 'leader', ctx)?.kind, 'state');
  ctx.current!.queueRevision = 1;
  assert.deepEqual(RadioStateWire.decode(packet, 'leader', ctx), {
    kind: 'snapshotRequired',
    minimumRevision: 7,
  });
  assert.equal(ctx.current!.revision, 6);
  ctx.current!.queueRevision = 2;
  ctx.current!.revision = 7;
  assert.equal(RadioStateWire.decode(packet, 'leader', ctx), null);
  ctx.awaitingSnapshot = true;
  assert.equal(RadioStateWire.decode(full(), 'leader', ctx)?.kind, 'state');
  ctx.minimumRevision = 8;
  assert.equal(RadioStateWire.decode(full(), 'leader', ctx), null);
});

test('invalid authority, identities, types, selection and queue options reject atomically', () => {
  for (const [index, value] of [
    [0, 'wrong-session'],
    [2, '7'],
    [4, 1],
    [7, NaN],
    [11, 'bad-id'],
    [13, 1200001],
    [15, 1],
    [18, false],
    [19, 2],
    [20, 'nonmember'],
    [21, 'wrong-session'],
    [24, 'wrong-host-session'],
    [28, 'leader'],
    [31, 'listener'],
    [32, 0],
  ] as const) {
    const packet = full();
    packet.fields[index] = value;
    assert.equal(RadioStateWire.decode(packet, 'leader', context()), null, `field ${index}`);
  }
  assert.equal(RadioStateWire.decode(full(), 'impostor', context()), null);
  assert.equal(RadioStateWire.decode(full(), 'leader', { ...context(), host: true }), null);
  const packet = full();
  packet.fields.push('tail');
  assert.equal(RadioStateWire.decode(packet, 'leader', context()), null);
});

test('radio expected position uses shared time, freezes while buffering and caps at track end', () => {
  assert.equal(RadioStateWire.expectedPosition(state, true, 7000), 3000);
  assert.equal(RadioStateWire.expectedPosition(state, true, 4000), 1000);
  assert.equal(RadioStateWire.expectedPosition(state, false, 7000), 1000);
  assert.equal(RadioStateWire.expectedPosition({ ...state, buffering: true }, true, 7000), 1000);
  assert.equal(RadioStateWire.expectedPosition(state, true, 999999), 100000);
  assert.equal(RadioStateWire.expectedPosition(null, true, 7000), 0);
  const copy = RadioStateWire.copyTrack({ ...state.queue[0], title: 'x'.repeat(160) });
  assert.equal(copy.title.length, 96);
});
