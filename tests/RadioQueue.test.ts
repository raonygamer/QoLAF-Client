import assert from 'node:assert/strict';
import test from 'node:test';
import { RadioQueue } from '../src/radio/RadioQueue';
import type { RadioState } from '../src/radio/RadioState';

function fixture(count = 3) {
  const state: RadioState = {
    roomId: 'room',
    hostId: 'host',
    name: 'Radio',
    revision: 0,
    queueRevision: 0,
    queue: Array.from({ length: count }, (_, i) => ({
      videoId: '0000000000' + i,
      title: 'Track ' + i,
      durationMs: 10000,
    })),
    playing: count > 0,
    buffering: false,
    positionMs: 100,
    anchorAt: 1000,
    playbackRevision: 0,
    currentIndex: 0,
    shuffle: false,
    repeatMode: 'off',
    keepFinished: false,
    playedMask: 0,
  };
  const publishes: boolean[] = [];
  let resets = 0;
  const owner = {
    state,
    host: true,
    online: true,
    synchronized: true,
    transferringLeadership: false,
    serverNow: 2000,
    resetReadiness: () => {
      resets++;
    },
    publish: (changed: boolean) => publishes.push(changed),
  };
  return {
    state,
    owner,
    publishes,
    resets: () => resets,
    queue: new RadioQueue(owner, () => 0.99),
  };
}

test('first enqueue and enqueue after exhaustion start a new buffered playback revision', () => {
  const f = fixture(0);
  const track = { videoId: 'AbC_123-xyz', title: 'x'.repeat(160), durationMs: 10000 };
  assert.equal(f.queue.enqueueTrack(track), true);
  assert.equal(f.state.queue[0].title.length, 96);
  assert.deepEqual(
    [
      f.state.playing,
      f.state.buffering,
      f.state.positionMs,
      f.state.anchorAt,
      f.state.playbackRevision,
    ],
    [true, true, 0, 2000, 1],
  );
  f.state.playing = f.state.buffering = false;
  f.state.positionMs = 10000;
  f.queue.enqueueTrack(track);
  assert.equal(f.state.currentIndex, 1);
  assert.equal(f.state.playbackRevision, 2);
  assert.deepEqual(f.publishes, [true, true]);
  while (f.state.queue.length < 10) assert.equal(f.queue.enqueueTrack(track), true);
  assert.equal(f.queue.enqueueTrack(track), false);
});

test('repeat-one applies only to natural completion; skip removes unless retention is enabled', () => {
  const f = fixture();
  f.queue.setQueueModes(false, 'one', false);
  f.queue.advanceTrack(true);
  assert.equal(f.state.queue.length, 3);
  assert.equal(f.state.currentIndex, 0);
  assert.equal(f.publishes.at(-1), false);
  f.queue.skip();
  assert.equal(f.state.queue[0].title, 'Track 1');
  assert.equal(f.state.queue.length, 2);
  f.queue.setQueueModes(false, 'off', true);
  f.queue.skip();
  assert.equal(f.state.currentIndex, 1);
  f.queue.skip();
  assert.equal(f.state.queue.length, 2);
  assert.equal(f.state.positionMs, 10000);
  assert.equal(f.state.playing, false);
  f.queue.resume();
  assert.equal(f.state.currentIndex, 0);
  assert.equal(f.state.playedMask, 0);
  assert.equal(f.state.buffering, true);
});

test('shuffle repeat-all resets the mask but avoids the boundary track when another exists', () => {
  const f = fixture();
  f.queue.setQueueModes(true, 'all', false);
  assert.equal(f.state.keepFinished, true);
  f.state.currentIndex = 1;
  f.state.playedMask = 0b101;
  f.queue.skip();
  assert.notEqual(f.state.currentIndex, 1);
  assert.equal(f.state.currentIndex, 0);
  assert.equal(f.state.playedMask, 0);
  assert.equal(f.state.queue.length, 3);
});

test('explicit removal shifts played bits and preserves the active track until it is removed', () => {
  const f = fixture(4);
  f.state.currentIndex = 2;
  f.state.playedMask = 0b1011;
  f.queue.removeTrack(1);
  assert.equal(f.state.currentIndex, 1);
  assert.equal(f.state.queue[1].title, 'Track 2');
  assert.equal(f.state.playedMask, 0b101);
  assert.equal(f.state.playbackRevision, 0);
  f.queue.removeTrack(1);
  assert.equal(f.state.queue[1].title, 'Track 3');
  assert.equal(f.state.playbackRevision, 1);
  assert.equal(f.state.playedMask, 1);
  f.queue.removeTrack(1);
  f.queue.removeTrack(0);
  assert.deepEqual(
    [
      f.state.queue.length,
      f.state.currentIndex,
      f.state.positionMs,
      f.state.playing,
      f.state.buffering,
    ],
    [0, 0, 0, false, false],
  );
});

test('pause/resume and seek preserve paused state and source clock scheduling', () => {
  const f = fixture();
  f.queue.pause();
  assert.equal(f.state.positionMs, 1100);
  f.queue.seek(999999);
  assert.equal(f.state.positionMs, 10000);
  assert.equal(f.state.playing, false);
  assert.equal(f.state.buffering, true);
  f.queue.seek(-10);
  assert.equal(f.state.positionMs, 0);
  f.queue.resume();
  assert.equal(f.state.anchorAt, 3000);
  assert.deepEqual(f.publishes, [false, false, false, false]);
  assert.equal(f.state.queueRevision, 0);
  assert.equal(f.state.revision, 4);
});

test('listeners, unsynchronized rooms and leadership handoff cannot mutate queue controls', () => {
  for (const field of ['host', 'synchronized', 'transferringLeadership'] as const) {
    const f = fixture();
    f.owner[field] = field === 'transferringLeadership';
    const before = JSON.stringify(f.state);
    f.queue.pause();
    f.queue.resume();
    f.queue.skip();
    f.queue.seek(0);
    f.queue.playTrack(1);
    f.queue.removeTrack(0);
    f.queue.setQueueModes(true, 'all', true);
    assert.equal(JSON.stringify(f.state), before, field);
    assert.equal(f.publishes.length, 0);
    assert.equal(f.resets(), 0);
  }
});
