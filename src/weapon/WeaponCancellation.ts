import { PlayerShip, type Weapon } from '../game/Bindings';

/** Stop an abandoned weapon without taking the native charged-shot release path. */
export function cancelWeaponFire(weapon: Weapon): void {
  if (weapon.hasChargeUp && weapon.chargeUpTime > 0) {
    const ship = weapon.unit;
    if (ship instanceof PlayerShip) {
      ship.killChargeUpEffect();
      if (ship.player?.isMe) weapon.g.hud?.powerBar?.updateLoadBar(0);
    }
    weapon.chargeUpTime = 0;
  }
  weapon.set_fire(false);
}
