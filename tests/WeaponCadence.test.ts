import assert from 'node:assert/strict';
import test from 'node:test';
import { WeaponCadence } from '../src/controller/WeaponCadence';

test('feedback follows actual volleys and expires without further shots', () => {
  const cadence = new WeaponCadence();
  assert.equal(cadence.sample(1000, 100).firing, false);
  cadence.shot(1000, 100);
  cadence.shot(1000, 100); // shotgun pellets are one volley
  cadence.shot(1066, 100);
  assert.deepEqual(cadence.sample(1080, 100), { interval: 66, firing: true });
  assert.equal(cadence.sample(1250, 100).firing, false);
  cadence.shot(5000, 100);
  assert.equal(cadence.sample(5000, 100).interval, 100);
});

test('slow weapons give a discrete pulse per confirmed shot', () => {
  const cadence = new WeaponCadence();
  cadence.shot(1000, 2000);
  assert.equal(cadence.sample(1020, 2000).firing, true);
  assert.equal(cadence.sample(1200, 2000).firing, false);
  cadence.shot(3000, 2000);
  assert.equal(cadence.sample(3020, 2000).firing, true);
});
