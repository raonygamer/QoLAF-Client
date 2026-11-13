import assert from 'node:assert/strict';
import test from 'node:test';
import { RewardRates } from '../src/telemetry/RewardRates';

test('rates use elapsed session time and can include recycled drops without double counting', () => {
  const rates = new RewardRates(1000);
  rates.add('xp', 1500);
  rates.add('cargo', 80);
  rates.add('artifacts', 3);
  rates.add('recycled', 7);
  assert.deepEqual(rates.perHour(1801000, false), { xp: 3000, cargo: 160, artifacts: 6 });
  assert.equal(rates.perHour(1801000, true).artifacts, 20);
  assert.equal(rates.perHour(3601000, true).artifacts, 10);
  rates.add('cargo', -100);
  rates.add('xp', NaN);
  assert.equal(rates.perHour(3601000, true).cargo, 80);
  assert.equal(rates.perHour(3601000, true).xp, 1500);
});
