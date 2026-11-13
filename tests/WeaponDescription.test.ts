import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponDescription } from '../src/weapon/WeaponDescription';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';
// @ts-expect-error captured native game method
import { createNativeWeaponDescription } from './fixtures/NativeWeaponDescription.js';

test('weapon translations preserve native stats, scaled debuffs, branches and unload', () => {
  const heading = "<FONT COLOR='#8888ff'>[name], lvl [level]</FONT>\n";
  const bonus =
    "\nDeals <FONT COLOR='#eeeeee'>[bonus]%</FONT> more damage if target is afflicted by [condition].";
  const translations = new Map([
    [heading, '<title>[name] / [level]</title>\n'],
    [bonus, '\nBonus [bonus]% against [condition].'],
    ['Flamethrower', 'Flames $&'],
    ['burning', 'Burn $1'],
  ]);
  let translated = false;
  const Localize = { t: (text: string) => (translated ? (translations.get(text) ?? text) : text) };
  class Cloak {}
  class PetSpawner {}
  const native = createNativeWeaponDescription(
    Cloak,
    PetSpawner,
    { string: String },
    { replace: (text: string, from: string, to: string) => text.split(from).join(to) },
    Localize,
    { debuffText: (_type: number, duration: number) => `debuff=${duration}\n` },
    { __cast: (value: object) => value },
    {},
  );
  class Weapon {
    name = 'Flamethrower';
    level = 6;
    specialCondition: string | null = 'burning';
    specialBonusPercentage = 25;
    multiNrOfP = 2;
    reloadTime = 300;
    burst = 3;
    shieldVamp = 2;
    healthVamp = 4;
    cloakDuration = 8;
    maxPets = 3;
    dmg = { damageText: () => 'native damage\n', dmg: () => 42 };
    weaponDebuffs = [{ type: 1, duration: 10, damage: 5 }];
    get_name() {
      return this.name;
    }
    scaledDebuffDuration(duration: number) {
      return duration * 7;
    }
    getDescription(compact: boolean): string {
      return native.call(this, compact);
    }
  }
  Object.setPrototypeOf(Cloak.prototype, Weapon.prototype);
  Object.setPrototypeOf(PetSpawner.prototype, Weapon.prototype);
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const classes: Record<string, object> = {
    'core.weapon.Weapon': Weapon,
    'generics.Localize': Localize,
  };
  const api = {
    cls: (name: string) => classes[name] ?? class {},
    around: (target: object, key: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(target, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installWeaponDescription(api);
  try {
    for (translated of [false, true]) {
      for (const name of ['Flamethrower', 'Acid Spray', 'Test']) {
        for (const condition of [null, '', 'burning']) {
          for (const compact of [false, true]) {
            for (const kind of [Weapon, Cloak, PetSpawner]) {
              const weapon = Object.assign(new kind(), new Weapon());
              weapon.name = name;
              weapon.specialCondition = condition;
              const baseline: string = native.call(weapon, compact);
              let expected = baseline;
              if (translated) {
                expected = expected.replace('<title>Flamethrower /', () => '<title>Flames $& /');
                if (condition)
                  expected = expected.replace(
                    /\nDeals[^\n]+$/,
                    () => '\nBonus 25% against Burn $1.',
                  );
              }
              const before = JSON.stringify(weapon);
              assert.equal(weapon.getDescription(compact), expected);
              assert.ok(expected.includes('debuff=70'));
              assert.equal(JSON.stringify(weapon), before);
            }
          }
        }
      }
    }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const weapon = new Weapon();
  assert.equal(weapon.getDescription(false), native.call(weapon, false));
});
