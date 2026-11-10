import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AimAssist, aimAngleDifference, type AimAssistInput } from '../src/aim/AimAssist';
import { createClientSettings } from '../src/ported/ClientSettings';

function setup() {
  // Use the actual ported source defaults, not a second copy of the tuning table.
  const Settings = createClientSettings(() => ({}));
  const overrides = new Map<string, number | boolean>([['aim_assist_enabled', true]]);
  const settings = {
    getAimAssistBoolean: (key: string) =>
      (overrides.get(key) ?? Settings.getAimAssistBooleanDefault(key)) as boolean,
    getAimAssistNumber: (key: string) =>
      (overrides.get(key) ?? Settings.getAimAssistNumberDefault(key)) as number,
  };
  const assist = new AimAssist(settings);
  const input: AimAssistInput = {
    now: 1000,
    angle: -0.1,
    shipRotation: 0,
    rotationSpeed: 1,
    tickLength: 33,
    mouseAim: true,
    mouseBlocked: false,
    keyboardDirection: 0,
    target: {},
    targetLocked: false,
    directAngle: 0,
    leadAngle: 0.02,
    rejectionReason: 'waiting for a locally simulated weapon hit',
  };
  const update = (patch: Partial<AimAssistInput> = {}) => {
    Object.assign(input, patch);
    assist.update(input);
  };
  return { assist, input, overrides, update };
}

test('source assist acquires from player intent, transitions to stationary tracking and honors manual override', () => {
  const f = setup();
  f.update();
  assert.equal(f.assist.active, false);
  f.update({ now: 1016, angle: -0.09 });
  assert.equal(f.assist.active, true);
  assert.equal(f.assist.tracking, false);
  assert.ok(Math.abs(f.assist.aimAngle - (-0.09 + 0.11 * 0.85)) < 1e-12);
  f.update({ now: 1200 });
  assert.equal(f.assist.tracking, true);
  assert.ok(Math.abs(f.assist.aimAngle - 0.02) < 1e-12);
  f.update({ now: 1216, angle: -0.11 });
  assert.equal(f.assist.active, false);
  assert.equal(f.assist.reason, 'manual override: steering away from target');
  assert.equal(f.assist.aimAngle, -0.11);
});

test('keyboard intent, lock profile and target identity preserve source acquisition gates', () => {
  const f = setup();
  f.update({ mouseAim: false, angle: -0.3, targetLocked: true, keyboardDirection: 1 });
  f.update({ now: 1016 });
  assert.equal(f.assist.active, true, 'locked profile allows the wider acquisition cone');
  assert.equal(f.assist.thresholdRatio(), 0.45);
  f.update({ now: 1032, target: {} });
  assert.equal(f.assist.active, false);
  assert.equal(f.assist.reason, 'confirmed hit target changed');
  f.update({ now: 1048, keyboardDirection: -1 });
  assert.equal(f.assist.active, false);
  assert.equal(f.assist.reason, 'turn key is steering away from the visible target');
  f.update({ now: 1064, keyboardDirection: 1, targetLocked: false });
  assert.equal(f.assist.active, false, 'ordinary profile has a smaller acquisition cone');
});

test('deadzone crossing stops at the lead point and tracking uses settle/restart hysteresis', () => {
  const f = setup();
  f.overrides.set('aim_assist_correction_ratio', 0);
  f.update({ angle: -0.02, leadAngle: 0.2 });
  f.update({ now: 1016, angle: -0.01 });
  assert.equal(f.assist.active, true);
  const threshold = 0.033 * 1.5 * 0.65;
  assert.ok(Math.abs(f.assist.aimAngle - (threshold + 0.033 * 0.35)) < 1e-12);
  assert.ok(f.assist.aimAngle <= f.input.leadAngle);
  f.update({ now: 1200 });
  assert.equal(f.assist.tracking, true);
  assert.equal(f.assist.shouldStopTracking(0.033, 0.03), true);
  assert.equal(f.assist.shouldStopTracking(0.033, 0.06), true);
  assert.equal(f.assist.shouldStopTracking(0.033, 0.07), false);
  assert.equal(f.assist.settled, false);
  f.assist.release('map navigation');
  assert.equal(f.assist.shouldStopTracking(0.033, 0), false);
});

test('disabled, blocked and missing-target input release assistance; wraparound uses the native signed difference', () => {
  assert.ok(Math.abs(aimAngleDifference(-Math.PI + 0.1, Math.PI - 0.1) - 0.2) < 1e-12);
  const f = setup();
  f.update();
  f.update({ now: 1016, angle: -0.09, mouseBlocked: true });
  assert.equal(f.assist.reason, 'mouse aim is blocked by keyboard steering');
  f.overrides.set('aim_assist_enabled', false);
  f.update({ now: 1032, mouseBlocked: false });
  assert.equal(f.assist.reason, 'aim assist is disabled in QoLAF settings');
  f.overrides.set('aim_assist_enabled', true);
  f.update({ now: 1048, target: null });
  assert.equal(f.assist.reason, f.input.rejectionReason);
  assert.equal(f.assist.active, false);
});
