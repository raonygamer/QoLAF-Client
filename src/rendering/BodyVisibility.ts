import type { API } from '../api/Types';
import type {} from '../game/CameraView';
import type {} from '../game/BodyVisibility';
import { GameReflection } from '../api/GameReflection';
import { Body } from '../game/Bindings';

function finiteExtent(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Body.updateIsNear includes zoom, portrait bounds, sprite size and zone radii. */
export function updateBodyVisibility(body: Body): void {
  const camera = body.g.camera;
  if (!camera || !Number.isFinite(camera._worldCullingRadius)) return;
  body.lastViewSizeRevision = camera._viewSizeRevision ?? 0;
  if (!body.g.get_me()?.ship || body.type === 'hidden' || body.type === 'boss') return;
  const position = body.get_pos();
  body.distanceToCameraX = position.x - (camera._upperLeftX + camera._lowerRightX) * 0.5;
  body.distanceToCameraY = position.y - (camera._upperLeftY + camera._lowerRightY) * 0.5;
  const visualRadius = body._mc
    ? Math.hypot(finiteExtent(body._mc.get_width()), finiteExtent(body._mc.get_height())) * 0.5
    : 0;
  const radius =
    (camera._worldCullingRadius ?? 0) * 1.5 +
    Math.max(visualRadius, finiteExtent(body.safeZoneRadius), finiteExtent(body.hostileZoneRadius));
  body.distanceToCamera = Math.hypot(body.distanceToCameraX, body.distanceToCameraY);
  body.nextDistanceCalculation = ((body.distanceToCamera - radius) / 600) * 100;
  if (body.distanceToCamera < radius) {
    if (!body.isAddedToCanvas) body.addToCanvasForReal();
  } else if (body.isAddedToCanvas) body.removeFromCanvas();
}

export function installBodyVisibility(api: API): void {
  const reflection = new GameReflection(api);
  const body = Body.prototype;
  reflection.around(body, 'updateIsNear', function (next, ...args) {
    // Construction can precede the camera's first valid transform sample.
    if (!Number.isFinite(this.g.camera?._worldCullingRadius)) return next(...args);
    updateBodyVisibility(this);
  });
  reflection.around(body, 'removeFromCanvas', function (next) {
    const canvas = this.canvas;
    const clip = this._mc;
    const wasAdded = this.isAddedToCanvas;
    const result = next();
    // Current Haxe clears canvas before GameObject.removeFromCanvas, leaving
    // the bitmap attached. The source client clears it after base removal.
    // Detach only that leftover child; the body still owns its reusable filter.
    if (wasAdded && !this.isAddedToCanvas && canvas && clip?.get_parent() === canvas)
      canvas.removeChild(clip);
    return result;
  });
  reflection.before(body, 'updateBody', function () {
    const camera = this.g.camera;
    if (!camera) return;
    if (
      !Number.isFinite(this.nextDistanceCalculation) ||
      camera.isZooming ||
      this.lastViewSizeRevision !== (camera._viewSizeRevision ?? 0)
    )
      this.nextDistanceCalculation = 0;
  });
}
