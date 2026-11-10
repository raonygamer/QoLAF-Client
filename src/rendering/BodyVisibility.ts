import { read, type API, type Raw } from '../api/Types';

/** Body.updateIsNear includes zoom, portrait bounds, sprite size and zone radii. */
export function updateBodyVisibility(body: Raw): void {
  const camera = body.g.camera;
  body.lastViewSizeRevision = camera._viewSizeRevision ?? 0;
  if (!read(body.g, 'me')?.ship || body.type === 'hidden' || body.type === 'boss') return;
  const position = read(body, 'pos');
  body.distanceToCameraX = position.x - (camera._upperLeftX + camera._lowerRightX) * 0.5;
  body.distanceToCameraY = position.y - (camera._upperLeftY + camera._lowerRightY) * 0.5;
  const visualRadius = body._mc
    ? Math.hypot(read(body._mc, 'width'), read(body._mc, 'height')) * 0.5
    : 0;
  const radius =
    camera._worldCullingRadius * 1.5 +
    Math.max(visualRadius, body.safeZoneRadius, body.hostileZoneRadius);
  body.distanceToCamera = Math.hypot(body.distanceToCameraX, body.distanceToCameraY);
  body.nextDistanceCalculation = ((body.distanceToCamera - radius) / 600) * 100;
  if (body.distanceToCamera < radius) {
    if (!body.isAddedToCanvas) body.addToCanvasForReal();
  } else if (body.isAddedToCanvas) body.removeFromCanvas();
}

export function installBodyVisibility(api: API): void {
  const body = api.cls('core.solarSystem.Body')?.prototype;
  if (!body) return;
  api.around(body, 'updateIsNear', function (next, ...args) {
    // Construction can precede the camera's first valid transform sample.
    if (!Number.isFinite(this.g.camera._worldCullingRadius)) return next(...args);
    updateBodyVisibility(this);
  });
  api.before(body, 'updateBody', function () {
    const camera = this.g.camera;
    if (camera.isZooming || this.lastViewSizeRevision !== (camera._viewSizeRevision ?? 0))
      this.nextDistanceCalculation = 0;
  });
}
