import type { CameraMotionState } from '../src/rendering/CameraMotion';
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
  const remote = {
    get_course: () => course,
    player: { isMe: false, isLanded: false },
    engine: null,
  };
  const rendered = sampleShipPose(remote, { x: 10, y: 20, rotation: 3.1 }, 0.5);
  assert.ok(rendered);
  assert.equal(rendered.x, 15);
  assert.equal(rendered.y, 30);
  assert.ok(Math.abs(Math.abs(rendered.rotation) - Math.PI) < 1e-10);
  const local = {
    get_course: () => course,
    player: { isMe: true, isLanded: false },
    engine: { get_rotationSpeed: () => 2 },
  };
  assert.equal(sampleShipPose(local, undefined, 0.5)?.x, 21.65);
  local.player.isLanded = true;
  assert.equal(sampleShipPose(local, undefined, 0.5)?.x, 20);
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
    newTime: 100,
    frameTime: 0,
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

function camera(): CameraMotionState & { focusTarget: { x: number; y: number } } {
  return {
    _switch: true,
    _stage: null,
    _stageContainer: null,
    _step: 10,
    _tempStep: 10,
    _targetLastX: 100,
    _targetLastY: 200,
    _targetCurrentX: 100,
    _targetCurrentY: 200,
    isSwaping: false,
    enableCallBack: false,
    isFocused: false,
    zoomStep: 10,
    _zoomFactor: 1,
    _shakeTimer: 0,
    _intensity: 0,
    _shakeDecay: 0,
    _swapFinishedEvent: null,
    _zoomFinishedEvent: null,
    _shakeFinishedEvent: null,
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
      return { top: false, bottom: false, left: false, right: false };
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
  const { installCameraFrames } = await import('../src/rendering/CameraFrames');
  const { bindGameClasses } = await import('../src/game/Bindings');
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
  const nativeDeltas: number[] = [];
  const instance = {
    camera: tracked,
    parallaxManager: {
      update(seconds: number) {
        nativeDeltas.push(seconds);
      },
    },
    update(event: { get_passedTime(): number }) {
      this.camera.update();
      this.parallaxManager.update(event.get_passedTime());
    },
  };
  // Haxe registers this callback before the plugin receives onGame.
  const cachedListener = instance.update.bind(instance);
  const classes: Record<string, any> = {
    'core.scene.Game': { prototype: { runGameLoop() {} } },
  };
  Object.assign(instance, { __class__: classes['core.scene.Game'] });
  const api: any = {
    cls: (name: string) => classes[name],
    log() {},
    defer: (cleanup: () => void) => cleanups.push(cleanup),
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
    bindGameClasses({
      ...api,
      cls: (name: string) => classes[name] ?? { prototype: {} },
      defer: (cleanup: () => void) => cleanups.push(cleanup),
    });
    installCameraFrames(api);
    const framePositions: number[] = [];
    const emitterDeltas: number[] = [];
    // Emitters install after interpolation, but must run before camera movement.
    api.before(instance.parallaxManager, 'update', (seconds: number) => {
      emitterDeltas.push(seconds);
      framePositions.push(tracked._focusTracker.x);
    });
    cachedListener({ get_passedTime: () => 0.0165 });
    assert.equal(framePositions[0], 0);
    assert.ok(tracked._focusTracker.x > 0, 'already-bound frame callback still follows the ship');
    const first = tracked._focusTracker.x;
    tracked.focusTarget.x = 300;
    cachedListener({ get_passedTime: () => 0.0165 });
    assert.equal(framePositions[1], first);
    assert.ok(tracked._focusTracker.x > first);
    assert.deepEqual(nativeDeltas, [1 / 60, 1 / 60], 'parallax consumes frame displacement once');
    assert.deepEqual(emitterDeltas, [0.0165, 0.0165], 'emitters retain the actual frame duration');
    tracked.shake();
    assert.equal(tracked.isShaking, false);
    assert.equal(tracked._shakeTimer, 0);
    assert.deepEqual(errors, []);
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup();
  }
});

test('enemy render endpoints remain stable when a network correction arrives between ticks', () => {
  const course = {
    pos: { x: 33, y: 0 },
    speed: { x: 1000, y: 0 },
    rotation: 0,
    rotateLeft: false,
    rotateRight: false,
  };
  const enemy = { get_course: () => course, engine: null };
  const previous = { x: 0, y: 0, rotation: 0 };
  const completed = { x: 33, y: 0, rotation: 0 };
  assert.equal(sampleShipPose(enemy, previous, 0.5, completed)?.x, 16.5);
  course.pos = { x: 45, y: 8 };
  course.rotation = 0.4;
  assert.equal(sampleShipPose(enemy, previous, 0.5, completed)?.x, 16.5);
  assert.equal(sampleShipPose(enemy, previous, 0.75, completed)?.x, 24.75);
  assert.equal(sampleShipPose(enemy, previous, 0.75, completed)?.rotation, 0);
  // The next tick starts at the preceding completed endpoint, absorbing the
  // corrected simulation result without rewriting the already-rendered span.
  const next = { x: 66, y: 8, rotation: 0.4 };
  assert.equal(sampleShipPose(enemy, completed, 0, next)?.x, 33);
  assert.equal(sampleShipPose(enemy, completed, 1, next)?.x, 66);
  assert.deepEqual(course.pos, { x: 45, y: 8 });
});
