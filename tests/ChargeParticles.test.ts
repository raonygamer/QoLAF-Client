import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindGameClasses } from '../src/game/Bindings';
import { installChargeParticles } from '../src/weapon/ChargeParticles';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('charge replacement, cooldown, switch and reuse release only owned particles', () => {
  class Effect {
    alive = true;
    killEmitter() {
      this.alive = false;
    }
    dispose() {}
  }
  class Ship {
    chargeUpEffect: Effect[] = [];
    selected!: Gun;
    get_weapon() {
      return this.selected;
    }
    startChargeUpEffect() {
      this.chargeUpEffect = [new Effect()];
    }
    killChargeUpEffect() {
      this.chargeUpEffect.forEach((e) => e.killEmitter());
    }
    reset() {
      this.chargeUpEffect = [];
    }
  }
  class Gun {
    hasChargeUp = true;
    chargeUpTime = 1;
    constructor(public unit: Ship) {}
    shoot() {
      this.chargeUpTime = 0;
    }
    set_fire(value: boolean) {
      if (this.chargeUpTime > 0) this.unit.killChargeUpEffect();
      return value;
    }
    destroy() {}
  }
  const classes: Record<string, object> = {
    'core.weapon.Weapon': Gun,
    'core.ship.PlayerShip': Ship,
    'core.weapon.ProjectileGun': Gun,
    'core.particle.Emitter': Effect,
  };
  const hooks = new Hooks();
  const api: any = { cls: (name: string) => classes[name] ?? class {} };
  for (const kind of ['before', 'around', 'after'])
    api[kind] = (...args: any[]) => hooks.add(args[0], args[1], kind, args[2]);
  bindGameClasses(api);
  installChargeParticles(api);
  const ship = new Ship();
  const a = (ship.selected = new Gun(ship));
  ship.startChargeUpEffect();
  const first = ship.chargeUpEffect[0];
  ship.startChargeUpEffect();
  const second = ship.chargeUpEffect[0];
  assert.equal(first.alive, false);
  a.shoot();
  assert.equal(second.alive, false);
  const b = (ship.selected = new Gun(ship));
  ship.startChargeUpEffect();
  const current = ship.chargeUpEffect[0];
  a.chargeUpTime = 1;
  a.set_fire(false);
  assert.equal(current.alive, true);
  b.chargeUpTime = 0;
  b.set_fire(false);
  assert.equal(current.alive, false);
  ship.startChargeUpEffect();
  const recycled = ship.chargeUpEffect[0];
  recycled.dispose();
  ship.reset();
  assert.equal(recycled.alive, true);
});
