import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, Weapon, WeaponManager, type GameObject } from '../game/Bindings';
import { DrawableWeapons } from './DrawableWeapons';

function drawVisible(objects: readonly GameObject[]): void {
  const count = objects.length;
  for (let index = 0; index < count; index++) {
    const object = objects[index];
    if (object.isAddedToCanvas) object.draw();
  }
}

/** Keep the current Haxe scene order; omit the original client's empty weapon draws. */
export function installNativeWeaponDraw(api: API): void {
  const reflection = new GameReflection(api);
  const emptyDraw = Weapon.prototype.draw;
  const source = emptyDraw.toString();
  const baseIsEmpty = source.slice(source.indexOf('{') + 1, source.lastIndexOf('}')).trim() === '';
  const lists = new WeakMap<WeaponManager, DrawableWeapons<Weapon>>();
  const list = (manager: WeaponManager) => {
    let result = lists.get(manager);
    if (!result) {
      result = new DrawableWeapons(
        () => manager.weapons,
        (weapon) => weapon.draw !== emptyDraw,
      );
      lists.set(manager, result);
    }
    return result;
  };
  reflection.after(WeaponManager.prototype, 'getWeapon', function (weapon) {
    lists.get(this)?.added(weapon);
  });
  reflection.around(WeaponManager.prototype, 'removeWeapon', function (next, index) {
    const weapon = this.weapons[index];
    const result = next(index);
    if (weapon && !this.weapons.includes(weapon)) lists.get(this)?.removed(weapon);
    return result;
  });
  reflection.around(GameScene.prototype, 'draw', function (next) {
    if (!baseIsEmpty || Weapon.prototype.draw !== emptyDraw) return next();
    this.parallaxManager?.draw();
    if (this.bodyManager) drawVisible(this.bodyManager.bodies);
    drawVisible(this.spawnManager.spawners);
    drawVisible(this.turretManager.turrets);
    drawVisible(this.dropManager.drops);
    drawVisible(this.bossManager.bosses);
    drawVisible(this.shipManager.ships);
    drawVisible(this.projectileManager.projectiles);
    const manager = this.weaponManager;
    if (!manager) return;
    // A later plugin may give the base Weapon a real draw implementation.
    const weapons = list(manager).values;
    const count = weapons.length;
    for (let index = 0; index < count; index++) weapons[index].draw();
  });
}
