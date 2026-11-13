import type { API } from '../api/Types';
import { DataLocator, Point, ProjectileFactory, StarlingCameraFocus } from '../game/Bindings';

/** Original instant-ray visibility radius includes the viewport at the current zoom. */
export function installInstantCulling(api: API): void {
  const pending = new WeakMap<StarlingCameraFocus, Point>();
  api.around(StarlingCameraFocus.prototype, 'getCameraCenter', function (next) {
    const origin = pending.get(this);
    if (!origin) return next();
    pending.delete(this);
    return origin;
  });
  api.around(ProjectileFactory, 'create', function (next, key, game, owner, weapon, heading) {
    if (!owner || !weapon) return next(key, game, owner, weapon, heading);
    const definition = DataLocator.getService().loadKey('Projectiles', key);
    const camera = game.camera;
    const canvas = game.canvas;
    const stage = game.get_stage();
    if (
      !camera ||
      !canvas ||
      !stage ||
      definition?.ai !== 'instant' ||
      owner.get_movieClip() === camera.focusTarget
    )
      return next(key, game, owner, weapon, heading);
    const position = owner.get_pos();
    if (Number.isNaN(position.x)) return null;
    const origin = heading?.pos ?? position;
    const center = camera.getCameraCenter();
    const dx = center.x - origin.x;
    const dy = center.y - origin.y;
    const distanceSquared = dx * dx + dy * dy;
    if (weapon.global && distanceSquared > 36000000) return null;
    const scale = Math.max(0.01, Math.abs(canvas.get_scaleX()));
    const radius =
      Math.max(0, weapon.range) +
      (0.5 * Math.hypot(stage.get_stageWidth(), stage.get_stageHeight())) / scale;
    if (distanceSquared > radius * radius) return null;

    // Visibility has been decided above. Neutralize only native factory's
    // first distance query, then immediately restore the real camera query.
    // No camera transform, weapon properties or projectile identity changes.
    const originSnapshot = new Point(origin.x, origin.y);
    pending.set(camera, originSnapshot);
    try {
      return next(key, game, owner, weapon, heading);
    } finally {
      if (pending.get(camera) === originSnapshot) pending.delete(camera);
    }
  });
}
