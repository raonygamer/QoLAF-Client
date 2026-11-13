import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayerShip, Weapon } from '../game/Bindings';
import { cancelWeaponFire } from './WeaponCancellation';

/** Original Weapon.update: stale fire flags cannot run an unequipped local gun. */
export function installWeaponFireOwnership(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(Weapon.prototype, 'update', function (next) {
    const ship = this.unit;
    if (
      this.get_fire() &&
      ship instanceof PlayerShip &&
      ship.player?.isMe &&
      ship.player.ship === ship &&
      ship.get_weapon() !== this
    ) {
      cancelWeaponFire(this);
      return;
    }
    return next();
  });
}
