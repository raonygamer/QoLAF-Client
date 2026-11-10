import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleShipPose, updateSimulation, updateCamera } from '../src/Rendering/Interpolation';

test('ship render interpolation matches local prediction, remote angle wrap and landing ownership', () => {
  const course = {
    pos: { x: 20, y: 40 },
    speed: { x: 100, y: 0 },
    rotation: -3.1,
    rotateLeft: false,
    rotateRight: false,
  };
  const remote = { course, player: { isMe: false } };
  const rendered = sampleShipPose(remote, { x: 10, y: 20, rotation: 3.1 }, 0.5);
  assert.equal(rendered.x, 15);
  assert.equal(rendered.y, 30);
  assert.ok(Math.abs(Math.abs(rendered.rotation) - Math.PI) < 1e-10);
  const local = { course, player: { isMe: true, isLanded: false }, engine: { rotationSpeed: 2 } };
  assert.equal(sampleShipPose(local, undefined, 0.5).x, 21.65);
  local.player.isLanded = true;
  assert.equal(sampleShipPose(local, undefined, 0.5).x, 20);
  assert.deepEqual(
    course.pos,
    { x: 20, y: 40 },
    'rendering must never modify simulation coordinates',
  );
});

test('fixed simulation uses elapsed time despite server clock corrections and renders between ticks', () => {
  let elapsed = 100;
  let ticks = 0;
  let renders = 0;
  let resets = 0;
  const machine = {
    _clock: { get_elapsedTime: () => elapsed, get_time: () => -99999 },
    currentTime: 100,
    accumulator: 0,
    currentState: { get_loaded: () => true, tickUpdate: () => ticks++, execute: () => renders++ },
    previousState: null,
    inputManager: { reset: () => resets++ },
  };
  elapsed += 16.5;
  updateSimulation(machine);
  assert.equal(ticks, 0);
  assert.equal(machine.accumulator, 16.5);
  elapsed += 16.5;
  updateSimulation(machine);
  assert.equal(ticks, 1);
  assert.equal(machine.accumulator, 0);
  assert.equal(renders, 2);
  assert.equal(resets, 2);
  elapsed -= 100;
  updateSimulation(machine);
  assert.equal(ticks, 1);
  elapsed += 10_000;
  updateSimulation(machine);
  assert.equal(ticks, 16, 'catch-up caps at 500 ms');
});

function camera() {
  return {
    _switch: true,
    focusTarget: { x: 100, y: 200 },
    trackStep: 10,
    _focusTracker: { x: 0, y: 0 },
    _focusCurrentLoc: { x: 0, y: 0 },
    _focusLastLoc: { x: 0, y: 0 },
    speed: { x: 0, y: 0 },
    isZooming: false,
    isShaking: false,
    positionStageContainer() {},
    positionParallax() {},
    testBounds() {
      return {};
    },
    updateViewRectangle() {},
  };
}
test('camera easing has the same result at 30 Hz and 180 Hz', () => {
  const slow = camera(),
    fast = camera();
  for (let i = 0; i < 30; i++) updateCamera(slow, 33);
  for (let i = 0; i < 180; i++) updateCamera(fast, 33 / 6);
  assert.ok(Math.abs(slow._focusTracker.x - fast._focusTracker.x) < 1e-10);
  assert.ok(Math.abs(slow._focusTracker.y - fast._focusTracker.y) < 1e-10);
});
