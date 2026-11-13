import assert from 'node:assert/strict';
import test from 'node:test';
import { DamageRumble } from '../src/controller/DamageRumble';

test('incoming DPS builds from subtle damage to full rumble and fades after damage stops', () => {
  const damage = new DamageRumble();
  assert.equal(damage.intensity(0), 0);
  damage.record(0, 1, 1000);
  const light = damage.intensity(0);
  assert.ok(light > 0 && light < 0.1);
  damage.record(100, 49, 1000);
  assert.ok(damage.intensity(100) > light);
  damage.record(200, 200, 1000);
  assert.equal(damage.intensity(200), 1);
  assert.equal(damage.intensity(600), 0.5);
  assert.equal(damage.intensity(801), 0);
  damage.clear();
  assert.equal(damage.intensity(802), 0);
});
