import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleShipPose, updateSimulation, updateCamera } from '../src/rendering/Interpolation';

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

test('camera follows the cached game listener using the render delta and disables original shake', async () => {
  // @ts-expect-error actual host JavaScript fixture
  const { Hooks } = await import('./fixtures/HostCore.js');
  const { installInterpolation } = await import('../src/rendering/Interpolation');
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanups: (() => void)[] = [];
  const tracked = Object.assign(camera(), {
    _shakeTimer: 200,
    isShaking: true,
    update() {
      throw Error('simulation must not update the camera');
    },
    shake() {
      this.isShaking = true;
    },
  });
  const instance = {
    camera: tracked,
    parallaxManager: { update(_seconds: number) {} },
    update(event: { get_passedTime(): number }) {
      this.camera.update();
      this.parallaxManager.update(event.get_passedTime());
    },
  };
  // Haxe registers this callback before the plugin receives onGame.
  const cachedListener = instance.update.bind(instance);
  const classes: Record<string, any> = {
    'core.states.GameStateMachine': { prototype: { update() {}, set_clock() {} } },
    'core.ship.Ship': { prototype: { update() {}, reset() {}, draw() {} } },
    'core.scene.Game': { prototype: { runGameLoop() {} } },
  };
  const api: any = {
    cls: (name: string) => classes[name],
    log() {},
    onGame: (callback: Function) => callback(instance, api),
  };
  for (const kind of ['before', 'after', 'around']) {
    api[kind] = (target: any, key: string, callback: Function) => {
      const remove = hooks.add(target, key, kind, callback);
      cleanups.push(remove);
      return remove;
    };
  }
  try {
    installInterpolation(api);
    cachedListener({ get_passedTime: () => 0.0165 });
    assert.ok(tracked._focusTracker.x > 0, 'already-bound frame callback still follows the ship');
    const first = tracked._focusTracker.x;
    tracked.focusTarget.x = 300;
    cachedListener({ get_passedTime: () => 0.0165 });
    assert.ok(tracked._focusTracker.x > first);
    tracked.shake();
    assert.equal(tracked.isShaking, false);
    assert.equal(tracked._shakeTimer, 0);
    assert.deepEqual(errors, []);
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup();
  }
});
