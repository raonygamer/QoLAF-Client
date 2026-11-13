import assert from 'node:assert/strict';
import test from 'node:test';
import { ControllerRepeat, nearestMenuTarget } from '../src/controller/MenuNavigation';
import { controllerStyle, controllerHasIntent } from '../src/controller/ControllerIdentity';

test('directional navigation prefers aligned controls and never wraps unexpectedly', () => {
  const targets = [
    { item: 'a', x: 0, y: 0, width: 100, height: 30 },
    { item: 'b', x: 120, y: 0, width: 100, height: 30 },
    { item: 'c', x: 0, y: 50, width: 100, height: 30 },
  ];
  assert.equal(nearestMenuTarget(targets, targets[0], 1, 0)?.item, 'b');
  assert.equal(nearestMenuTarget(targets, targets[0], 0, 1)?.item, 'c');
  assert.equal(nearestMenuTarget(targets, targets[0], -1, 0)?.item, 'a');
  assert.equal(nearestMenuTarget([], null, 1, 0), null);
});

test('activation is edge-triggered while navigation repeats after an initial delay', () => {
  const repeat = new ControllerRepeat();
  assert.equal(repeat.take('confirm', true, 0), true);
  assert.equal(repeat.take('confirm', true, 10000), false);
  repeat.take('confirm', false, 10001);
  assert.equal(repeat.take('confirm', true, 10002), true);
  assert.equal(repeat.take('right', true, 0, true), true);
  assert.equal(repeat.take('right', true, 399, true), false);
  assert.equal(repeat.take('right', true, 400, true), true);
  assert.equal(repeat.take('right', true, 519, true), false);
});

test('controller identity supports Firefox and Chromium IDs and explicit override', () => {
  assert.equal(controllerStyle('054c-0ce6-Wireless Controller'), 'playstation');
  assert.equal(
    controllerStyle('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'),
    'playstation',
  );
  assert.equal(controllerStyle('Xbox 360 Controller (XInput STANDARD GAMEPAD)'), 'xbox');
  assert.equal(controllerStyle('Unknown controller'), 'generic');
  assert.equal(controllerStyle('XInput', 'playstation'), 'playstation');
  assert.equal(controllerHasIntent([], [0.1, -0.15], 0.15), false);
  assert.equal(controllerHasIntent([{ value: 1 }], [], 0.15), true);
});
