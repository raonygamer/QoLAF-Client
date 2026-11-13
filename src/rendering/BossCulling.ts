import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Boss } from '../game/Bindings';
import type {} from '../game/CameraView';

/** Source Boss visibility uses the displayed camera; radar stays player-relative. */
export function installBossCulling(api: API): void {
  const reflection = new GameReflection(api);
  const revisions = new WeakMap<Boss, number>();
  reflection.around(Boss.prototype, 'updateIsNear', function (next) {
    const camera = this.g.camera;
    if (!camera || !Number.isFinite(camera._worldCullingRadius)) return next();
    revisions.set(this, camera.get_viewSizeRevision());
    const position = this.get_pos();
    const distance = Math.hypot(
      position.x - camera.get_viewCenterX(),
      position.y - camera.get_viewCenterY(),
    );
    const radius = camera.get_worldCullingRadius() + Math.max(0, this.bossRadius);
    this.nextDistanceCalculation = Math.min(5000, ((distance - radius) / 600) * 100);
    if (distance < radius) {
      if (!this.isAddedToCanvas) this.addToCanvas();
    } else if (this.isAddedToCanvas) this.removeFromCanvas();
  });
  reflection.before(Boss.prototype, 'update', function () {
    const camera = this.g.camera;
    if (!camera || !Number.isFinite(camera._worldCullingRadius)) return;
    if (camera.isZooming || revisions.get(this) !== camera.get_viewSizeRevision())
      this.nextDistanceCalculation = 0;
  });
  reflection.before(Boss.prototype, 'reset', function () {
    revisions.delete(this);
  });
}
