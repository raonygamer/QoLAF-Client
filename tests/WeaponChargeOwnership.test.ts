import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type PlayerShip } from '../src/game/Bindings';
import { chargingWeapon, installWeaponChargeOwnership } from '../src/weapon/WeaponChargeOwnership';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('charge effect ownership follows the native caller, restores nested calls, and clears on exceptions', () => {
  const owners: unknown[] = [];
  class Ship {
    selected: Gun | null = null;
    get_weapon() {
      return this.selected;
    }
    startChargeUpEffect() {
      owners.push(chargingWeapon(this as unknown as PlayerShip));
    }
  }
  class Gun {
    nested: (() => void) | null = null;
    fail = false;
    constructor(public unit: Ship) {}
    shoot() {
      this.unit.startChargeUpEffect();
      this.nested?.();
      this.unit.startChargeUpEffect();
      if (this.fail) throw Error('native failure');
      return 42;
    }
  }
  class Teleport extends Gun {
    shoot() {
      return super.shoot();
    }
  }
  const classes: Record<string, object> = {
    'core.ship.PlayerShip': Ship,
    'core.weapon.ProjectileGun': Gun,
    'core.weapon.Teleport': Teleport,
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? class {},
    around: (target: object, name: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(target, name, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponChargeOwnership(api);
  const ship = new Ship();
  const selected = (ship.selected = new Gun(ship));
  const firing = new Gun(ship),
    teleport = new Teleport(ship);
  const other = new Ship();
  other.selected = new Gun(other);
  try {
    firing.nested = () => {
      teleport.shoot();
      other.startChargeUpEffect();
    };
    assert.equal(firing.shoot(), 42);
    assert.deepEqual(owners, [firing, teleport, teleport, other.selected, firing]);
    owners.length = 0;
    ship.startChargeUpEffect();
    assert.deepEqual(owners, [selected]);
    owners.length = 0;
    firing.nested = null;
    firing.fail = true;
    assert.throws(() => firing.shoot(), /native failure/);
    ship.startChargeUpEffect();
    assert.deepEqual(owners, [firing, firing, selected]);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  firing.fail = false;
  owners.length = 0;
  firing.shoot();
  assert.deepEqual(owners, [selected, selected]);
});
