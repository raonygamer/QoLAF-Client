import assert from 'node:assert/strict';
import { test } from 'node:test';
import { networkTime } from '../src/rendering/NetworkTime';

test('visual clock reads native clock without writing simulation time', () => {
  const game = {
    time: 990,
    clock: { getServerTime: () => 1005 },
    getServerTime() {
      this.time = 1005;
      return this.time;
    },
  };
  assert.equal(networkTime(game), 1005);
  assert.equal(game.time, 990);
  assert.equal(networkTime({ ...game, get_networkServerTime: () => 1010 }), 1010);
  assert.equal(networkTime({ ...game, networkServerTime: 0 }), 0);
});

test('source observer getter does not also evaluate the native clock fallback', () => {
  assert.equal(
    networkTime({
      get_networkServerTime: () => 1234,
      clock: { getServerTime: () => assert.fail('fallback must be lazy') },
    }),
    1234,
  );
  for (const game of [null, undefined, {}, { clock: null }, { networkServerTime: NaN }])
    assert.ok(Number.isNaN(networkTime(game)));
});
