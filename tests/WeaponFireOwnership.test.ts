import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponFireOwnership } from '../src/weapon/WeaponFireOwnership';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('only unequipped current local weapons stop, without releasing a stale charged shot', () => {
  let chargeUI = 1;
  class PlayerShip {
    weapon: Weapon | null = null;
    player = { isMe: true, ship: this as PlayerShip | null };
    get_weapon() {
      return this.weapon;
    }
    cleared = 0;
    killChargeUpEffect() {
      this.cleared++;
    }
  }
  class Weapon {
    fire = true;
    hasChargeUp = false;
    chargeUpTime = 0;
    updates = 0;
    released = 0;
    g = {
      hud: {
        powerBar: {
          updateLoadBar: (value: number) => {
            chargeUI = value;
          },
        },
      },
    };
    constructor(public unit: PlayerShip | object) {}
    get_fire() {
      return this.fire;
    }
    set_fire(value: boolean) {
      if (!value && this.hasChargeUp && this.chargeUpTime > 0) this.released++;
      this.chargeUpTime = 0;
      this.fire = value;
    }
    update() {
      this.updates++;
      return 42;
    }
  }
  const classes: Record<string, object> = {
    'core.ship.PlayerShip': PlayerShip,
    'core.weapon.Weapon': Weapon,
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => classes[name] ?? class {},
    around: (target: object, key: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(target, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponFireOwnership(api);
  const local = new PlayerShip();
  const selected = (local.weapon = new Weapon(local));
  const stale = new Weapon(local);
  try {
    assert.equal(selected.update(), 42);
    stale.hasChargeUp = true;
    stale.chargeUpTime = 50;
    stale.update();
    assert.equal(stale.updates, 0);
    assert.equal(stale.fire, false);
    assert.equal(stale.released, 0);
    assert.equal(local.cleared, 1);
    assert.equal(chargeUI, 0);
    const remote = new PlayerShip();
    remote.player.isMe = false;
    const mirror = new PlayerShip();
    mirror.player.ship = local;
    for (const owner of [remote, mirror, {}]) {
      const weapon = new Weapon(owner);
      assert.equal(weapon.update(), 42);
      assert.equal(weapon.fire, true);
    }
    stale.update();
    assert.equal(stale.updates, 1, 'inactive weapons retain the native update path');
    selected.hasChargeUp = true;
    selected.chargeUpTime = 50;
    selected.set_fire(false);
    assert.equal(selected.released, 1, 'ordinary charge release is preserved');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  stale.fire = true;
  assert.equal(stale.update(), 42, 'unload restores native update');
});
