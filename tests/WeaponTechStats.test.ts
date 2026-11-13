import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponTechStats } from '../src/weapon/WeaponTechStats';
import type { WeaponTechDefinition } from '../src/game/WeaponTechDefinition';
// @ts-expect-error current native Haxe method with dependency bindings only
import { createNativeWeaponTech } from './fixtures/NativeWeaponTech.js';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('tech variance guard preserves omitted fields and all other native tech calculations', () => {
  const native = createNativeWeaponTech(
    class {},
    { degreesToRadians: (degrees: number) => (degrees * Math.PI) / 180 },
    { string: String },
  );
  class Weapon {
    positionYVariance = 17;
    damage = 100;
    dmg = {
      dmg: () => this.damage,
      setBaseDmg: (value: number) => {
        this.damage = value;
      },
    };
    weaponDebuffs = [];
    speed = 100;
    range = 200;
    reloadTime = 300;
    ttl = 400;
    acceleration = 5;
    aimArc = 1;
    rotationSpeed = 2;
    multiNrOfP = 1;
    multiOffset = 0;
    multiAngleOffset = 0;
    heatCost = 0;
    numberOfHits = 1;
    shieldVamp = 0;
    healthVamp = 0;
    addTechStats(definition: WeaponTechDefinition, level: number) {
      return native.call(this, definition, level);
    }
  }
  const level = () => ({
    incDmg: 10,
    incReloadRate: 5,
    incRange: 2,
    incSpeed: 3,
    incAcceleration: 4,
    incSpread: 0,
    incRotationSpeed: 6,
    incMultiNrOfP: 1,
    incMultiOffset: 2,
    incMultiAngleOffset: 3,
  });
  const snapshot = (weapon: Weapon) =>
    Object.fromEntries(
      Object.entries(weapon).filter(([key]) => key !== 'dmg' && key !== 'positionYVariance'),
    );
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.weapon.Weapon' ? Weapon : class {}),
    around: (target: object, key: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(target, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponTechStats(api);
  try {
    for (const count of [0, 1, 3, 6, 9]) {
      for (const variance of ['missing', 'inherited', undefined, 0, 25] as const) {
        const levels = Array.from({ length: 6 }, level);
        const final = levels[Math.min(count, 6) - 1];
        if (final && variance === 'inherited')
          Object.setPrototypeOf(final, { positionVariance: 9 });
        else if (final && variance !== 'missing')
          Object.assign(final, { positionVariance: variance });
        const definition: WeaponTechDefinition = { techLevels: levels };
        const before = structuredClone(definition);
        const baseline = new Weapon(),
          observed = new Weapon();
        native.call(baseline, definition, count);
        observed.addTechStats(definition, count);
        assert.deepEqual(snapshot(observed), snapshot(baseline));
        assert.equal(
          observed.positionYVariance,
          count === 0 || variance === 'missing' || variance === 'inherited' ? 17 : variance,
        );
        assert.deepEqual(
          structuredClone(definition),
          before,
          'cached definitions must not be mutated',
        );
        if (final && variance === 'inherited')
          assert.equal(Object.getPrototypeOf(final).positionVariance, 9);
      }
    }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const restored = new Weapon();
  restored.addTechStats({ techLevels: [level()] }, 1);
  assert.equal(restored.positionYVariance, undefined, 'unload restores native behavior');
});
