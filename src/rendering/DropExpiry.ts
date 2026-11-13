import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Drop } from '../game/Bindings';

/** Drop.as: warning follows the current expiry deadline, including tractor pickup extensions. */
export function dropExpiryAlpha(remainingMilliseconds: number): number {
  if (remainingMilliseconds <= 0 || remainingMilliseconds >= 10000) return 1;
  const phase = ((10000 - remainingMilliseconds) % 800) / 800;
  const amount = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return 1 - 0.6 * amount;
}

export function updateDropExpiry(drop: Drop): void {
  if (!drop.isAddedToCanvas || drop.expireTime === 0) return;
  drop.set_alpha(dropExpiryAlpha(drop.expireTime - drop.g.time));
}

/** Preserve native pickup/movement/expiry order; replace only the perpetual alpha tween. */
export function updateDrop(drop: Drop): void {
  drop.tractorBeamUpdate();
  const position = drop.get_pos();
  position.x += drop.speed.x;
  position.y += drop.speed.y;
  drop.speed.x *= 0.9;
  drop.speed.y *= 0.9;
  updateDropExpiry(drop);
  if (drop.g.time > drop.expireTime && drop.expireTime !== 0) drop.expire();
  drop.set_rotation(drop.get_rotation() + drop.randAngleSpeed);
  if (drop.nextDistanceCalculation <= 0) drop.updateIsNear();
  else drop.nextDistanceCalculation -= 33;
}

export function installDropExpiry(api: API): void {
  const reflection = new GameReflection(api);
  const observed = new Set<Drop>();
  reflection.around(Drop.prototype, 'update', function () {
    observed.add(this);
    // Unsafe activation may encounter a warning started by vanilla before install.
    if (this.fadeTween) {
      this.fadeTween.kill();
      this.fadeTween = null;
    }
    updateDrop(this);
  });
  reflection.before(Drop.prototype, 'reset', function () {
    observed.delete(this);
  });
  api.defer(() => {
    for (const drop of observed) drop.set_alpha(1);
    observed.clear();
  });
}
