import type { API } from '../api/Types';
import { ProjectileManager, type GameScene, type Projectile } from '../game/Bindings';

/** Refresh estimate identity only when the server assigns a new unit target. */
export function installProjectileTargetHistory(
  api: API,
  game: GameScene,
  capture: (projectile: Projectile) => void,
): void {
  api.after(ProjectileManager.prototype, 'handleBouncing', function (_result, message, offset) {
    if (this.g !== game) return;
    const projectile = this.projectilesById.h[String(message.getInt(offset))];
    if (projectile) capture(projectile);
  });
  api.after(ProjectileManager.prototype, 'updateCourse', function (_result, message) {
    if (this.g !== game) return;
    for (let offset = 0; offset + 13 < message.length; offset += 14) {
      if (message.getInt(offset + 1) !== 1) continue;
      const projectile = this.projectilesById.h[String(message.getInt(offset))];
      if (projectile) capture(projectile);
    }
  });
}
