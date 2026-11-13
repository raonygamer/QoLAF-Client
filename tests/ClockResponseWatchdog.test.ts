import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClockResponseWatchdog } from '../src/clock/ClockResponseWatchdog';
import { ResponseSamples } from '../src/network/ResponseSamples';

class PendingResponse extends ResponseSamples {
  override get pendingSince(): number {
    return 0;
  }
}

test('a short cancelled warp gives an outstanding request a fresh foreground timeout', () => {
  const samples = new PendingResponse();
  const watchdog = new ClockResponseWatchdog();
  for (let now = 0; now <= 9750; now += 250)
    assert.equal(watchdog.update(true, samples, now), false);

  // Warp stops Game.update, so no inactive frame reaches the watchdog. This
  // explicit source reset must also work when cancellation takes less than
  // the watchdog's 500 ms stall threshold.
  watchdog.reset(samples.sequence);
  assert.equal(watchdog.update(true, samples, 9900), false);
  for (let now = 10150; now < 19900; now += 250)
    assert.equal(watchdog.update(true, samples, now), false);
  assert.equal(watchdog.update(true, samples, 19900), true);
  assert.equal(watchdog.update(true, samples, 20150), false, 'disconnect only once');
});

test('hidden time and a suspended frame loop do not count toward the foreground timeout', () => {
  for (const hiddenFrame of [false, true]) {
    const samples = new PendingResponse();
    const watchdog = new ClockResponseWatchdog();
    for (let now = 0; now <= 9750; now += 250)
      assert.equal(watchdog.update(true, samples, now), false);
    if (hiddenFrame) assert.equal(watchdog.update(false, samples, 10000), false);
    // Browsers may suspend the frame loop entirely, without an inactive update.
    const resumed = 3600000;
    assert.equal(watchdog.update(true, samples, resumed), false);
    for (let now = resumed + 250; now < resumed + 10000; now += 250)
      assert.equal(watchdog.update(true, samples, now), false);
    assert.equal(watchdog.update(true, samples, resumed + 10000), true);
  }
});
