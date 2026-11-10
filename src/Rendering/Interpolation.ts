import { read, type API, type Raw } from '../Api/Types';
import { installRemoteShips } from './RemoteShips';

export interface RenderPose {
  x: number;
  y: number;
  rotation: number;
}

function wrapRadians(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((((angle + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}

/** Ship.as: local extrapolation, remote interpolation, and tween-owned landing. */
export function sampleShipPose(
  ship: Raw,
  previous: RenderPose | undefined,
  alpha: number,
): RenderPose {
  const course = read(ship, 'course');
  const position = course.pos;
  const localPlayer = ship.player?.isMe === true;
  const landingTween = ship.player?.isLanded === true && !read(ship, 'landed', false);
  let { x, y } = position;
  let rotation = course.rotation;

  if (!landingTween) {
    if (localPlayer) {
      x += course.speed.x * 0.033 * alpha;
      y += course.speed.y * 0.033 * alpha;
    } else if (previous) {
      x = previous.x + (position.x - previous.x) * alpha;
      y = previous.y + (position.y - previous.y) * alpha;
      rotation = wrapRadians(previous.rotation + wrapRadians(rotation - previous.rotation) * alpha);
    }
  }

  if (localPlayer && !ship.forcedRotation && ship.engine) {
    const turn = 0.001 * read(ship.engine, 'rotationSpeed') * 33 * alpha;
    if (course.rotateLeft) rotation -= turn;
    if (course.rotateRight) rotation += turn;
    rotation = wrapRadians(rotation);
  }
  if (ship.player && !localPlayer && !landingTween && ship.sampleRemoteRotation) {
    const remoteRotation = ship.sampleRemoteRotation();
    if (!Number.isNaN(remoteRotation)) rotation = remoteRotation;
  }
  return { x, y, rotation };
}

/** GameStateMachine.as uses local elapsed time, never the corrected server clock. */
export function updateSimulation(machine: Raw): void {
  if (!machine._clock) return;
  machine.newTime = read(machine._clock, 'elapsedTime');
  machine.frameTime = Math.max(0, Math.min(500, machine.newTime - machine.currentTime));
  machine.currentTime = machine.newTime;
  machine.accumulator += machine.frameTime;
  while (machine.accumulator >= 33) {
    machine.currentState?.tickUpdate();
    machine.accumulator -= 33;
  }
  if (
    machine.currentState &&
    read(machine.currentState, 'loaded') &&
    (!machine.previousState || read(machine.previousState, 'unloaded'))
  ) {
    machine.currentState.execute();
  }
  machine.inputManager.reset();
}

function resetTiming(machine: Raw): void {
  machine.accumulator = 0;
  machine.frameTime = 0;
  machine.currentTime = machine._clock ? read(machine._clock, 'elapsedTime') : 0;
  machine.newTime = machine.currentTime;
}

/** StarlingCameraFocus.as: the original easing rate, independent of display FPS. */
export function updateCamera(camera: Raw, milliseconds: number): void {
  if (!camera._switch) return;
  const focus = camera.focusTarget;
  if (!focus) {
    camera.speed.x = 0;
    camera.speed.y = 0;
    return;
  }
  camera._tempStep = camera.trackStep;
  camera._step = camera._tempStep;
  const frames = Math.max(0, Math.min(3, milliseconds / 33));
  const tracking = 1 - Math.pow(1 - 1 / camera._step, frames);
  const focusX = read(focus, 'x');
  const focusY = read(focus, 'y');
  if ((focusX - camera._focusTracker.x) * (focusY - camera._focusTracker.y) <= 1000) {
    if (camera.isSwaping) {
      camera.isSwaping = false;
      if (camera.enableCallBack) camera._stage.dispatchEvent(camera._swapFinishedEvent);
    }
    camera.isFocused = true;
  } else {
    camera.isFocused = false;
  }
  camera.speed.x = (focusX - camera._focusTracker.x) * tracking;
  camera.speed.y = (focusY - camera._focusTracker.y) * tracking;
  camera._focusTracker.x += camera.speed.x;
  camera._focusTracker.y += camera.speed.y;
  camera._focusLastLoc.x = camera._focusCurrentLoc.x;
  camera._focusLastLoc.y = camera._focusCurrentLoc.y;
  camera._focusCurrentLoc.x = camera._focusTracker.x;
  camera._focusCurrentLoc.y = camera._focusTracker.y;
  camera._targetLastX = camera._targetCurrentX;
  camera._targetLastY = camera._targetCurrentY;
  camera._targetCurrentX = focusX;
  camera._targetCurrentY = focusY;
  if (camera.isZooming) {
    const zoom = 1 - Math.pow(1 - 1 / camera.zoomStep, frames);
    const container = camera._stageContainer;
    container.set_scaleX(
      read(container, 'scaleX') + (camera._zoomFactor - read(container, 'scaleX')) * zoom,
    );
    container.set_scaleY(
      read(container, 'scaleY') + (camera._zoomFactor - read(container, 'scaleY')) * zoom,
    );
    if (Math.abs(read(container, 'scaleX') - camera._zoomFactor) < 0.00001) {
      camera.isZooming = false;
      container.set_scaleX(camera._zoomFactor);
      container.set_scaleY(camera._zoomFactor);
      if (camera.enableCallBack) camera._stage.dispatchEvent(camera._zoomFinishedEvent);
    }
  }
  camera.positionStageContainer();
  camera.positionParallax(camera.testBounds());
  camera.updateViewRectangle();
  if (camera.isShaking && camera._shakeTimer > 0) {
    camera._shakeTimer -= milliseconds;
    if (camera._shakeTimer <= 0) {
      camera._shakeTimer = 0;
      camera.isShaking = false;
      if (camera.enableCallBack) camera._stage.dispatchEvent(camera._shakeFinishedEvent);
    } else {
      camera._intensity -= camera._shakeDecay * milliseconds;
      const container = camera._stageContainer;
      const width = read(camera._stage, 'stageWidth');
      const height = read(camera._stage, 'stageHeight');
      container.set_x(
        Math.random() * camera._intensity * width * 2 -
          camera._intensity * width +
          read(container, 'x'),
      );
      container.set_y(
        Math.random() * camera._intensity * height * 2 -
          camera._intensity * height +
          read(container, 'y'),
      );
    }
  }
}

export function installInterpolation(api: API): void {
  const machine = api.cls('core.states.GameStateMachine')?.prototype;
  const ship = api.cls('core.ship.Ship')?.prototype;
  const game = api.cls('core.scene.Game')?.prototype;
  if (!machine || !ship || !game) throw Error('Interpolation runtime classes are missing');
  const previous = new WeakMap<Raw, RenderPose>();
  const remoteShips = installRemoteShips(api);

  api.around(machine, 'update', function () {
    updateSimulation(this);
  });
  api.after(machine, 'set_clock', function () {
    resetTiming(this);
  });
  api.before(game, 'runGameLoop', function () {
    if (this.gameStateMachine) resetTiming(this.gameStateMachine);
  });
  api.before(ship, 'update', function () {
    const course = this.converger?.course;
    if (!course || Number.isNaN(read(this, 'pos')?.x)) return;
    previous.set(this, { x: course.pos.x, y: course.pos.y, rotation: course.rotation });
  });
  api.before(ship, 'reset', function () {
    previous.delete(this);
  });
  api.after(ship, 'draw', function () {
    const course = read(this, 'course');
    const clip = this._mc;
    if (!course || !clip || !this.imgObj) return;
    const alpha = Math.max(0, Math.min(1, this.g.gameStateMachine.accumulator / 33));
    const pose = sampleShipPose(this, previous.get(this), alpha);
    const remoteRotation = remoteShips.sample(this);
    if (Number.isFinite(remoteRotation)) pose.rotation = remoteRotation;
    clip.set_x(pose.x);
    clip.set_y(pose.y);
    clip.set_rotation(this.forcedRotation ? this._rotation : pose.rotation);
    if (this.miniBarsAreAddedToCanvas) {
      for (const bar of [this.hpBar, this.shieldBar]) {
        bar.set_x(pose.x);
        bar.set_y(read(bar, 'y') + pose.y - course.pos.y);
      }
    }
  });
  // The camera used to run inside tickUpdate. Move it to the render-frame path.
  api.onGame((instance, session) => {
    const camera = instance.camera;
    let frameMilliseconds = 0;
    session.around(camera, 'update', function () {});
    session.before(instance, 'update', function (event) {
      frameMilliseconds = read(event, 'passedTime', 0) * 1000;
    });
    session.before(instance.parallaxManager, 'update', function () {
      updateCamera(camera, frameMilliseconds);
    });
  });
}
