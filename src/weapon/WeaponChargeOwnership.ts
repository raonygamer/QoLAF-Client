import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayerShip, ProjectileGun, Teleport, type Weapon } from '../game/Bindings';

const charging = new WeakMap<PlayerShip, Weapon>();

/** Original explicit startChargeUpEffect weapon argument, recovered from its native caller. */
export function chargingWeapon(ship: PlayerShip): Weapon | null {
  return charging.get(ship) ?? ship.get_weapon();
}

export function installWeaponChargeOwnership(api: API): void {
  const reflection = new GameReflection(api);
  for (const Type of [ProjectileGun, Teleport]) {
    reflection.around(Type.prototype, 'shoot', function (next) {
      const ship = this.unit;
      if (!(ship instanceof PlayerShip)) return next();
      const previous = charging.get(ship);
      charging.set(ship, this);
      try {
        return next();
      } finally {
        if (previous) charging.set(ship, previous);
        else charging.delete(ship);
      }
    });
  }
}
