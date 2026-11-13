import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RosterRetry } from '../src/pvp/RosterRetry';
test('PvP roster retries back off to ten seconds and a complete roster resets recovery', () => {
  const retry = new RosterRetry();
  assert.deepEqual(
    Array.from({ length: 7 }, () => retry.requested(1000) - 1000),
    [2000, 3000, 4500, 6750, 10000, 10000, 10000],
  );
  assert.equal(retry.received(20000, false), 30000);
  assert.equal(retry.requested(30000), 40000);
  assert.equal(retry.received(40000, true), 50000);
  assert.equal(retry.requested(50000), 52000);
});
