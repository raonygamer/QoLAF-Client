import { read, type API, type Raw } from '../api/Types';

/** StarlingCameraFocus.updateViewRectangle: measure the displayed transform. */
export function updateCameraView(camera: Raw, corner: Raw): void {
  const stage = camera._stage;
  const container = camera._stageContainer;
  const scaleX = read(container, 'scaleX');
  const scaleY = read(container, 'scaleY');
  if (
    !stage ||
    !container ||
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    Math.abs(scaleX) < 0.000001 ||
    Math.abs(scaleY) < 0.000001
  )
    return;
  const width = read(stage, 'stageWidth');
  const height = read(stage, 'stageHeight');
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
    Math.abs(viewWidth - camera._viewWidth) > 0.01 ||
    Math.abs(viewHeight - camera._viewHeight) > 0.01
  )
    camera._viewSizeRevision = (camera._viewSizeRevision ?? 0) + 1;
  camera._viewWidth = viewWidth;
  camera._viewHeight = viewHeight;
  camera._worldCullingRadius = Math.max(viewWidth, Math.hypot(viewWidth, viewHeight) * 0.5);
}

/** Source overlap test also includes effects that enclose the entire viewport. */
export function circleInCameraView(camera: Raw, x: number, y: number, radius: number): boolean {
  return !(
    x + radius < camera._upperLeftX ||
    x - radius > camera._lowerRightX ||
    y + radius < camera._upperLeftY ||
    y - radius > camera._lowerRightY
  );
}

export function installCameraView(api: API): void {
  const camera = api.cls('camerafocus.StarlingCameraFocus')?.prototype;
  const Point = api.cls('openfl.geom.Point') as any;
  if (!camera || !Point) return;
  const corners = new WeakMap<Raw, Raw>();
  api.around(camera, 'updateViewRectangle', function () {
    let corner = corners.get(this);
    if (!corner) {
      corner = new Point();
      corners.set(this, corner!);
    }
    updateCameraView(this, corner!);
  });
  api.around(camera, 'isCircleOnScreen', function (_next, x, y, radius) {
    return circleInCameraView(this, x, y, radius);
  });
}
