import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { EnemyShip } from '../game/Bindings';

/** Source EnemyShip canvas/pool cleanup, retaining native emitter ownership checks. */
export function installEnemyLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(EnemyShip.prototype, 'addToCanvasForReal', function (next) {
    if (!this.isAddedToCanvas) return next();
  });
  reflection.before(EnemyShip.prototype, 'removeFromCanvas', function () {
    // Summoned units can have an AFName without the AF faction.
    this.AFName?.removeFromParent();
  });
  reflection.before(EnemyShip.prototype, 'reset', function () {
    this.killOwnEmitters(this.rareEmitters);
    this.killOwnEmitters(this.aiHardenedShieldEffect);
    this.AFName?.removeFromParent(true);
    this.AFName = null;
  });
}
