import assert from 'node:assert/strict';
import test from 'node:test';
import { IncomingWeaponHistory } from '../src/telemetry/IncomingWeaponHistory';

test('weapon fallback normalizes level suffixes but requires matching damage type and lifecycle', () => {
  const history = new IncomingWeaponHistory(1, () => 100);
  history.record('Naxar Wave Generator lvl ???', null, 'Pulse', 2, 1);
  assert.equal(history.resolve('Nexar Wave Generator', 2, 1), 'Pulse');
  assert.equal(history.resolve('Nexar Wave Generator', 3, 1), null);
  assert.equal(history.resolve('Nexar Wave Generator', 2, 2), null);
});

test('different candidate weapons remain ambiguous and repeated pellets refresh one contact', () => {
  let now = 0;
  const history = new IncomingWeaponHistory(1, () => now);
  history.record('Turret', 'Boss', 'Laser', 0, 1);
  now = 100;
  history.record('Turret', 'Boss', 'Laser', 0, 1);
  assert.equal(history.resolve('Boss', 0, 1), 'Laser');
  history.record('Turret', 'Boss', 'Missile', 0, 1);
  assert.equal(history.resolve('Boss', 0, 1), null);
  now = 1601;
  assert.equal(history.resolve('Boss', 0, 1), null);
});

test('contact age is inclusive at 1500ms, rejects reversed time, and stays bounded', () => {
  let now = 0;
  const history = new IncomingWeaponHistory(1, () => now);
  history.record('Enemy', null, 'Laser', 0, 1);
  now = 1500;
  assert.equal(history.resolve('Enemy', 0, 1), 'Laser');
  now = -1;
  assert.equal(history.resolve('Enemy', 0, 1), null);
  now = 0;
  for (let index = 0; index < 16; index++) history.record('Other' + index, null, 'Laser', 0, 1);
  assert.equal(history.resolve('Enemy', 0, 1), null);
});

test('wall attribution accepts the exact observed boost clamp point without widening the wall radius', () => {
  let now = 100;
  const history = new IncomingWeaponHistory(1, () => now);
  history.recordDeathLine(0, -100, 0, 100, -200, 0, 1);
  assert.equal(history.hasRecentDeathLineContact(-200, 0, 10, 1), true);
  assert.equal(history.hasRecentDeathLineContact(-190, 0, 10, 1), false);
  assert.equal(history.hasRecentDeathLineContact(18, 0, 10, 1), true);
  assert.equal(history.hasRecentDeathLineContact(19, 0, 10, 1), false);
  assert.equal(history.hasRecentDeathLineContact(-200, 0, 10, 2), false);
  now = 1601;
  assert.equal(history.hasRecentDeathLineContact(-200, 0, 10, 1), false);
});
