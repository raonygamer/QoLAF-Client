import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SoundPlaybackClock } from '../src/music/SoundPlaybackClock';

test('effect throttle survives forward and backward wall-clock changes', () => {
  let elapsed = 1000;
  let wall = 100000;
  const clock = new SoundPlaybackClock(
    () => elapsed,
    () => wall,
  );
  const sound = {};
  assert.equal(clock.accept(sound, true, wall - 20), false, 'adopt recent native playback');
  wall += 3600000;
  elapsed += 45;
  assert.equal(clock.accept(sound, true, 0), false);
  elapsed++;
  assert.equal(clock.accept(sound, true, 0), true, 'exactly 66 elapsed milliseconds');
  wall -= 7200000;
  elapsed += 66;
  assert.equal(clock.accept(sound, true, wall), true);
  assert.equal(clock.accept(sound, true, 0), false);
  assert.equal(clock.accept(sound, false, wall), true, 'exclusive music is never throttled');
  assert.equal(clock.accept({}, true, 0), true, 'independent new sounds can start immediately');
});
