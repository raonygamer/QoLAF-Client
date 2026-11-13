import type { StarlingCameraFocus } from '../game/Bindings';
import type { Game } from '../game/Game';

type Position = Pick<Game.openfl.geom.Point, 'x' | 'y'>;

/** Native camera state used by the original frame-time motion algorithm. */
export interface CameraMotionState
  extends Pick<
    StarlingCameraFocus,
    | '_switch'
    | 'trackStep'
    | '_tempStep'
    | '_step'
    | 'isSwaping'
    | 'enableCallBack'
    | 'isFocused'
    | '_targetLastX'
    | '_targetLastY'
    | '_targetCurrentX'
    | '_targetCurrentY'
    | 'isZooming'
    | 'zoomStep'
    | '_zoomFactor'
    | 'isShaking'
    | '_shakeTimer'
    | '_intensity'
    | '_shakeDecay'
    | '_swapFinishedEvent'
    | '_zoomFinishedEvent'
    | '_shakeFinishedEvent'
    | 'positionStageContainer'
    | 'positionParallax'
    | 'testBounds'
    | 'updateViewRectangle'
  > {
  focusTarget: Position | Pick<Game.starling.display.DisplayObject, 'get_x' | 'get_y'> | null;
  speed: Position;
  _focusTracker: Position;
  _focusCurrentLoc: Position;
  _focusLastLoc: Position;
  _stage: Pick<
    Game.starling.display.Stage,
    'dispatchEvent' | 'get_stageWidth' | 'get_stageHeight'
  > | null;
  _stageContainer: Pick<
    Game.starling.display.DisplayObject,
    | 'get_x'
    | 'get_y'
    | 'set_x'
    | 'set_y'
    | 'get_scaleX'
    | 'get_scaleY'
    | 'set_scaleX'
    | 'set_scaleY'
  > | null;
}

/** StarlingCameraFocus.as: the original easing rate, independent of display FPS. */
export function updateCamera(camera: CameraMotionState, milliseconds: number): void {
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
  const focusX = 'get_x' in focus ? focus.get_x() : focus.x;
  const focusY = 'get_y' in focus ? focus.get_y() : focus.y;
  if ((focusX - camera._focusTracker.x) * (focusY - camera._focusTracker.y) <= 1000) {
    if (camera.isSwaping) {
      camera.isSwaping = false;
      if (camera.enableCallBack && camera._swapFinishedEvent)
        camera._stage?.dispatchEvent(camera._swapFinishedEvent);
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
  if (camera.isZooming && camera._stageContainer) {
    const zoom = 1 - Math.pow(1 - 1 / camera.zoomStep, frames);
    const container = camera._stageContainer;
    container.set_scaleX(
      container.get_scaleX() + (camera._zoomFactor - container.get_scaleX()) * zoom,
    );
    container.set_scaleY(
      container.get_scaleY() + (camera._zoomFactor - container.get_scaleY()) * zoom,
    );
    if (Math.abs(container.get_scaleX() - camera._zoomFactor) < 0.00001) {
      camera.isZooming = false;
      container.set_scaleX(camera._zoomFactor);
      container.set_scaleY(camera._zoomFactor);
      if (camera.enableCallBack && camera._zoomFinishedEvent)
        camera._stage?.dispatchEvent(camera._zoomFinishedEvent);
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
      if (camera.enableCallBack && camera._shakeFinishedEvent)
        camera._stage?.dispatchEvent(camera._shakeFinishedEvent);
    } else {
      camera._intensity -= camera._shakeDecay * milliseconds;
      const container = camera._stageContainer;
      if (!container || !camera._stage) return;
      const width = camera._stage.get_stageWidth();
      const height = camera._stage.get_stageHeight();
      container.set_x(
        Math.random() * camera._intensity * width * 2 -
          camera._intensity * width +
          container.get_x(),
      );
      container.set_y(
        Math.random() * camera._intensity * height * 2 -
          camera._intensity * height +
          container.get_y(),
      );
    }
  }
}
