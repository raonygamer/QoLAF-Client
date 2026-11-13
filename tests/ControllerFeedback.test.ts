import assert from 'node:assert/strict';
import test from 'node:test';
import {
  feedbackOutput,
  systemLight,
  weaponTrigger,
  type WeaponFeedback,
} from '../src/controller/ControllerFeedback';
import { defaultControllerPreferences } from '../src/controller/ControllerSettings';

const weapon: WeaponFeedback = {
  type: 'projectile',
  interval: 100,
  speed: 800,
  firing: true,
  charging: false,
  missile: false,
};

test('trigger profiles distinguish sustained beams, missiles, charging and rapid projectiles', () => {
  assert.equal(weaponTrigger({ ...weapon, type: 'beam' }, 0.5).kind, 'vibration');
  assert.equal(weaponTrigger({ ...weapon, missile: true }, 0.5).kind, 'vibration');
  assert.equal(weaponTrigger({ ...weapon, charging: true, firing: false }, 0.5).kind, 'resistance');
  const rapid = weaponTrigger(weapon, 0.5);
  assert.equal(rapid.kind, 'vibration');
  if (rapid.kind === 'vibration') assert.equal(rapid.frequency, 10);
  assert.equal(weaponTrigger({ ...weapon, type: 'teleport' }, 1).kind, 'off');
  assert.equal(weaponTrigger(weapon, 0).kind, 'off');
});

test('lighting and vibration preferences independently control outputs', () => {
  const preferences = defaultControllerPreferences();
  preferences.vibration = 0;
  const off = feedbackOutput(preferences, weapon, 'argoon', 10, 1, true);
  assert.equal(off.strong, 0);
  assert.equal(off.weak, 0);
  assert.equal(off.light, undefined);
  assert.equal(off.population, undefined);
  assert.equal(off.right.kind, 'off');
  preferences.systemLight = preferences.populationLights = preferences.adaptiveTriggers = true;
  const on = feedbackOutput(preferences, weapon, 'argoon', 10, 0, false);
  assert.deepEqual(on.light, systemLight('argoon'));
  assert.equal(on.population, 10);
  assert.notDeepEqual(systemLight('argoon'), systemLight('fulzar'));
});

test('weapon trigger feedback follows a remapped fire trigger', () => {
  const preferences = defaultControllerPreferences();
  preferences.adaptiveTriggers = true;
  preferences.mappings = [{ action: 19, binding: { kind: 'button', index: 6 } }];
  const output = feedbackOutput(preferences, weapon, 'argoon', 1, 0, false);
  assert.equal(output.right.kind, 'off');
  assert.equal(output.left.kind, 'vibration');
});
