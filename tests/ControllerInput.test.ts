import assert from 'node:assert/strict';
import test from 'node:test';
import { ControllerInput, cycleWeapon, shapeAxis } from '../src/controller/ControllerInput';

const thresholds = { deadzone: 0.15, press: 0.5, release: 0.35, exponent: 1 };
const mappings = [
  { action: 19, binding: { kind: 'button' as const, index: 7 } },
  { action: 19, binding: { kind: 'button' as const, index: 0 } },
];
function snapshot(trigger: number, face = 0) {
  return {
    axes: [],
    buttons: Array.from({ length: 8 }, (_, index) => ({
      value: index === 7 ? trigger : index === 0 ? face : 0,
    })),
  };
}

test('hysteresis suppresses trigger chatter and preserves a press until the simulation tick', () => {
  const input = new ControllerInput();
  input.update(snapshot(0.6), mappings, thresholds);
  input.update(snapshot(0.45), mappings, thresholds);
  assert.equal(input.isDown(19), true);
  assert.equal(input.isPressed(19), true);
  input.finishTick();
  input.update(snapshot(0.4), mappings, thresholds);
  assert.equal(input.isPressed(19), false);
  input.update(snapshot(0.3), mappings, thresholds);
  assert.equal(input.isDown(19), false);
  input.update(snapshot(0.45), mappings, thresholds);
  assert.equal(input.isDown(19), false);
});

test('multiple bindings do not release each other; disconnect clears pending actions', () => {
  const input = new ControllerInput();
  input.update(snapshot(1, 1), mappings, thresholds);
  input.finishTick();
  input.update(snapshot(0, 1), mappings, thresholds);
  assert.equal(input.isDown(19), true);
  assert.equal(input.isPressed(19), false);
  input.update(null, mappings, thresholds);
  assert.equal(input.isDown(19), false);
  assert.equal(input.isPressed(19), false);
});

test('axis shaping removes drift and keeps signed full travel', () => {
  assert.equal(shapeAxis(0.14, thresholds), 0);
  assert.equal(shapeAxis(-1, thresholds), -1);
  assert.equal(shapeAxis(1, thresholds), 1);
  assert.ok(Math.abs(shapeAxis(0.575, thresholds) - 0.5) < 1e-10);
  assert.equal(shapeAxis(Number.NaN, thresholds), 0);
});

test('carousel skips empty hotkeys, wraps, and handles no weapons', () => {
  assert.equal(cycleWeapon([1, 3, 5], 3, 1), 5);
  assert.equal(cycleWeapon([1, 3, 5], 5, 1), 1);
  assert.equal(cycleWeapon([1, 3, 5], 1, -1), 5);
  assert.equal(cycleWeapon([], 1, 1), null);
});
