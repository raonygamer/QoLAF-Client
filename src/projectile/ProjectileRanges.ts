import type { API } from '../api/Types';
import { ProjectileFactory, ProjectileManager } from '../game/Bindings';

/** Reset pooled ranges and distinguish instant ray length from projectile speed. */
export function installProjectileRanges(api: API): void {
  api.after(ProjectileFactory, 'create', function (projectile, _key, _game, _owner, weapon) {
    if (!projectile) return;
    const range = weapon?.range ?? 0;
    projectile.range = Number.isFinite(range) && range > 0 ? range : 0;
  });
  api.around(
    ProjectileManager.prototype,
    'createSetProjectile',
    function (next, projectile, id, unit, heading, index, offsetX, offsetY, speed = 0) {
      if (projectile?.stateMachine.inState('Instant')) {
        if (Number.isFinite(speed) && speed > 0) projectile.range = speed;
        projectile.speedMax = 10000;
        // Native treats this argument as speed before fastforward, then as
        // ray length afterwards. Both values are already prepared above.
        return next(projectile, id, unit, heading, index, offsetX, offsetY, 0);
      }
      return next(
        projectile,
        id,
        unit,
        heading,
        index,
        offsetX,
        offsetY,
        Number.isFinite(speed) ? speed : 0,
      );
    },
  );
}
