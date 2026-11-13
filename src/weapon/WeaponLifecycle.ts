import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, Turret, TurretManager, WeaponManager, type Weapon } from '../game/Bindings';
import { cancelWeaponFire } from './WeaponCancellation';

/** Destroy effects before detaching their owner from the current scene. */
export function destroyManagedWeapon(manager: WeaponManager | null, weapon: Weapon): void {
  cancelWeaponFire(weapon);
  if (weapon.alive) weapon.destroy();
  if (!manager) return;
  const index = manager.weapons.indexOf(weapon);
  if (index >= 0) manager.removeWeapon(index);
}

export function releaseTurretWeapon(turret: Turret): void {
  const weapon = turret.weapon;
  if (!weapon) return;
  // Clear ownership before callbacks, making repeated/removal reentry harmless.
  turret.weapon = null;
  destroyManagedWeapon(turret.g.weaponManager, weapon);
}

/** Preserve rebuildable turrets; release weapons only at terminal ownership boundaries. */
export function installWeaponLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  reflection.before(Turret.prototype, 'destroy', function () {
    if (this.weapon) cancelWeaponFire(this.weapon);
  });
  reflection.around(TurretManager.prototype, 'removeTurret', function (_next, turret) {
    if (!turret) return;
    releaseTurretWeapon(turret);
    const index = this.turrets.indexOf(turret);
    if (index >= 0) this.turrets.splice(index, 1);
  });
  reflection.around(WeaponManager.prototype, 'removeWeapon', function (next, index) {
    if (Number.isInteger(index) && index >= 0 && index < this.weapons.length) next(index);
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    const manager = this.weaponManager;
    if (!manager) return;
    // Iterate a snapshot: destroying beams can synchronously remove effects/owners.
    for (const weapon of [...manager.weapons]) destroyManagedWeapon(manager, weapon);
  });
}
