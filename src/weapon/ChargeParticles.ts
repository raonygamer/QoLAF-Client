import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Emitter, PlayerShip, ProjectileGun, Weapon } from '../game/Bindings';
import { chargingWeapon } from './WeaponChargeOwnership';

const owners = new WeakMap<PlayerShip, Weapon>();

export function ownsChargeParticles(ship: PlayerShip, weapon: Weapon): boolean {
  const owner = owners.get(ship);
  return !owner || owner === weapon;
}

/** Native charge emitters can run indefinitely, including after the charge timer resets. */
export function installChargeParticles(api: API): void {
  const hooks = new GameReflection(api);
  const ships = new WeakMap<Emitter, PlayerShip>();
  let settingFire: Weapon | null = null;
  const clear = (ship: PlayerShip) => {
    owners.delete(ship);
    const effects: Emitter[] = ship.chargeUpEffect ?? [];
    ship.chargeUpEffect = [];
    for (const emitter of effects) {
      ships.delete(emitter);
      if (emitter.alive) emitter.killEmitter();
    }
  };
  hooks.around(PlayerShip.prototype, 'startChargeUpEffect', function (next, ...args) {
    clear(this);
    const result = next(...args);
    const owner = chargingWeapon(this);
    if (owner) owners.set(this, owner);
    for (const effect of this.chargeUpEffect ?? []) ships.set(effect, this);
    return result;
  });
  hooks.around(PlayerShip.prototype, 'killChargeUpEffect', function () {
    const owner = owners.get(this);
    if (settingFire?.unit === this && owner && owner !== settingFire) return;
    clear(this);
  });
  hooks.before(PlayerShip.prototype, 'reset', function () {
    clear(this);
  });
  hooks.before(Emitter.prototype, 'dispose', function () {
    const ship = ships.get(this);
    if (!ship) return;
    ships.delete(this);
    const effects: Emitter[] = ship.chargeUpEffect;
    const index = effects.indexOf(this);
    if (index >= 0) effects.splice(index, 1);
  });
  const release = (weapon: Weapon) => {
    const ship = weapon.unit;
    if (ship instanceof PlayerShip && owners.get(ship) === weapon) clear(ship);
  };
  hooks.after(ProjectileGun.prototype, 'shoot', function () {
    if (this.hasChargeUp && this.chargeUpTime === 0) release(this);
  });
  hooks.before(Weapon.prototype, 'destroy', function () {
    release(this);
  });
  hooks.around(Weapon.prototype, 'set_fire', function (next, fire) {
    const ship = this.unit;
    if (!(ship instanceof PlayerShip)) return next(fire);
    if (!fire) release(this);
    const previous = settingFire;
    settingFire = this;
    try {
      return next(fire);
    } finally {
      settingFire = previous;
    }
  });
}
