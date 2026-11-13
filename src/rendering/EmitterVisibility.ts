import type { Emitter, StarlingCameraFocus } from '../game/Bindings';

/** Native emitter state used by the original footprint-aware culling rules. */
export type EmitterVisibility = Pick<
  Emitter,
  | 'sourceVarianceX'
  | 'sourceVarianceY'
  | 'speed'
  | 'ttl'
  | 'ttlVariance'
  | 'get_radius'
  | 'forceUpdate'
  | 'isOnScreen'
  | 'posX'
  | 'posY'
  | 'nextDistanceCalculation'
  | 'distanceToCameraX'
  | 'distanceToCameraY'
  | 'distanceToCamera'
  | 'MAX_CALC_DELAY'
> & {
  canvasTarget: object | null;
  g: {
    camera:
      | (Pick<StarlingCameraFocus, 'isCircleOnScreen'> & {
          getCameraCenter(): { x: number; y: number };
        })
      | null;
  };
};

/** Emitter.as includes the authored particle footprint and travel in culling. */
export function emitterCullingRadius(emitter: EmitterVisibility): number {
  const spread = Math.max(Math.abs(emitter.sourceVarianceX), Math.abs(emitter.sourceVarianceY));
  const travel = (Math.abs(emitter.speed) * (emitter.ttl + Math.abs(emitter.ttlVariance))) / 1000;
  return Math.max(100, emitter.get_radius() + spread + travel);
}

export function updateEmitterVisibility(emitter: EmitterVisibility): void {
  emitter.forceUpdate = false;
  emitter.isOnScreen = emitter.canvasTarget != null;
  if (emitter.isOnScreen) {
    emitter.nextDistanceCalculation = 1000;
    return;
  }
  const camera = emitter.g.camera;
  if (!camera) {
    // A scene can temporarily have no camera while it is being constructed or torn down.
    // Recheck next frame instead of scheduling a distance-based delay without a view.
    emitter.forceUpdate = true;
    emitter.nextDistanceCalculation = 0;
    return;
  }
  emitter.isOnScreen = camera.isCircleOnScreen(
    emitter.posX,
    emitter.posY,
    emitterCullingRadius(emitter),
  );
  if (emitter.isOnScreen) {
    emitter.nextDistanceCalculation = 1000;
    return;
  }
  const center = camera.getCameraCenter();
  emitter.distanceToCameraX = emitter.posX - center.x;
  emitter.distanceToCameraY = emitter.posY - center.y;
  emitter.distanceToCamera = Math.hypot(emitter.distanceToCameraX, emitter.distanceToCameraY);
  emitter.nextDistanceCalculation = emitter.distanceToCamera;
  if (emitter.nextDistanceCalculation > emitter.MAX_CALC_DELAY) {
    emitter.nextDistanceCalculation = emitter.MAX_CALC_DELAY + Math.random() * 200;
  }
}
