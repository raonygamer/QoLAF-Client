import type { API } from '../api/Types';
import type {} from '../game/CameraView';
import { GameReflection } from '../api/GameReflection';
import { StarlingCameraFocus, Point } from '../game/Bindings';

interface CameraBounds {
  _upperLeftX: number;
  _upperLeftY: number;
  _lowerRightX: number;
  _lowerRightY: number;
}

type CameraPoint = Pick<Point, 'x' | 'y' | 'setTo'>;
interface CameraViewState extends CameraBounds {
  _stage: { get_stageWidth(): number; get_stageHeight(): number } | null;
  _stageContainer: {
    get_scaleX(): number;
    get_scaleY(): number;
    globalToLocal(point: CameraPoint, result: CameraPoint): unknown;
  } | null;
  _viewWidth?: number;
  _viewHeight?: number;
  _viewSizeRevision?: number;
  _worldCullingRadius?: number;
}

/** StarlingCameraFocus.updateViewRectangle: measure the displayed transform. */
export function updateCameraView(camera: CameraViewState, corner: CameraPoint): void {
  const stage = camera._stage;
  const container = camera._stageContainer;
  if (!stage || !container) return;
  const scaleX = container.get_scaleX();
  const scaleY = container.get_scaleY();
  if (
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    Math.abs(scaleX) < 0.000001 ||
    Math.abs(scaleY) < 0.000001
  )
    return;
  const width = stage.get_stageWidth();
  const height = stage.get_stageHeight();
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (let index = 0; index < 4; index++) {
    corner.setTo(index & 1 ? width : 0, index & 2 ? height : 0);
    container.globalToLocal(corner, corner);
    left = Math.min(left, corner.x);
    right = Math.max(right, corner.x);
    top = Math.min(top, corner.y);
    bottom = Math.max(bottom, corner.y);
  }
  camera._upperLeftX = left;
  camera._upperLeftY = top;
  camera._lowerRightX = right;
  camera._lowerRightY = bottom;
  const viewWidth = right - left,
    viewHeight = bottom - top;
  if (
    !Number.isFinite(camera._viewWidth) ||
    !Number.isFinite(camera._viewHeight) ||
    Math.abs(viewWidth - (camera._viewWidth ?? NaN)) > 0.01 ||
    Math.abs(viewHeight - (camera._viewHeight ?? NaN)) > 0.01
  )
    camera._viewSizeRevision = ((camera._viewSizeRevision ?? 0) + 1) >>> 0;
  camera._viewWidth = viewWidth;
  camera._viewHeight = viewHeight;
  camera._worldCullingRadius = Math.max(viewWidth, Math.hypot(viewWidth, viewHeight) * 0.5);
}

/** Source overlap test also includes effects that enclose the entire viewport. */
export function circleInCameraView(
  camera: CameraBounds,
  x: number,
  y: number,
  radius: number,
): boolean {
  return !(
    x + radius < camera._upperLeftX ||
    x - radius > camera._lowerRightX ||
    y + radius < camera._upperLeftY ||
    y - radius > camera._lowerRightY
  );
}

export function installCameraView(api: API): void {
  const reflection = new GameReflection(api);
  const camera = StarlingCameraFocus.prototype;
  const getters = {
    get_viewCenterX(this: StarlingCameraFocus) {
      return (this._upperLeftX + this._lowerRightX) * 0.5;
    },
    get_viewCenterY(this: StarlingCameraFocus) {
      return (this._upperLeftY + this._lowerRightY) * 0.5;
    },
    get_worldCullingRadius(this: StarlingCameraFocus) {
      return this._worldCullingRadius ?? 0;
    },
    get_viewSizeRevision(this: StarlingCameraFocus) {
      return this._viewSizeRevision ?? 0;
    },
  };
  for (const [name, getter] of Object.entries(getters)) {
    if (typeof Reflect.get(camera, name) === 'function') continue;
    const previous = Object.getOwnPropertyDescriptor(camera, name);
    Object.defineProperty(camera, name, { configurable: true, writable: true, value: getter });
    api.defer(() => {
      if (Object.getOwnPropertyDescriptor(camera, name)?.value !== getter) return;
      if (previous) Object.defineProperty(camera, name, previous);
      else Reflect.deleteProperty(camera, name);
    });
  }
  reflection.after(camera, 'setFocusPosition', function () {
    this._viewSizeRevision = ((this._viewSizeRevision ?? 0) + 1) >>> 0;
  });
  const corners = new WeakMap<StarlingCameraFocus, Point>();
  reflection.around(camera, 'updateViewRectangle', function () {
    let corner = corners.get(this);
    if (!corner) {
      corner = new Point();
      corners.set(this, corner);
    }
    updateCameraView(this, corner);
  });
  reflection.around(camera, 'isCircleOnScreen', function (_next, x, y, radius) {
    return circleInCameraView(this, x, y, radius);
  });
}
