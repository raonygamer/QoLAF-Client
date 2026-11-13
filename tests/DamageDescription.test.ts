import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { damageDescription, debuffDamageDescription } from '../src/weapon/DamageDescription';
// @ts-expect-error original AS3 execution boundary
import { install } from './fixtures/As3Methods.js';

test('damage descriptions match original localized text without mutating damage', () => {
  const source = readFileSync(new URL('./fixtures/weapon/Damage.as', import.meta.url), 'utf8');
  let cases = 0;
  for (const translated of [false, true]) {
    const translate = (text: string) =>
      translated
        ? text
            .replace('Deals', 'Causa')
            .replace('Repairs', 'Repara')
            .replace('Health', 'Vida')
            .replace('Energy', 'Energia')
            .replace('Corrosive', 'Corrosivo')
        : text;
    for (const damage of [
      [0, 0, 0, 0, 0],
      [10.5, 0, 0, 0, 0],
      [0, 2.3, 0, 0, 0],
      [10, 20, 30, 40, 50],
      [0, 0, 0, 4.7, 0],
      [-1, NaN, Infinity, 1, 0],
    ]) {
      const original = {
        damage,
        Localize: { t: translate },
        SINGLETYPE_NAME: ['Kinetic', 'Energy', 'Corrosive', 'Health', 'Special'],
        SINGLETYPE_COLOR: ['#00ffff', '#ff030d', '#009900', '#00ff00', '#ff0000'],
        damageText: (): string => '',
        debuffdamageText: (_multiplier: number, _duration: number, _timing: string): string => '',
      };
      install(original, source, ['getSingleTypeHtml', 'damageText', 'debuffdamageText']);
      const before = [...damage];
      assert.equal(damageDescription(damage, translate), original.damageText());
      for (const timing of [' after', ' over', '', 'unsupported'])
        for (const multiplier of [0, 0.25, 2]) {
          assert.equal(
            debuffDamageDescription(damage, multiplier, 1.25, timing, translate),
            original.debuffdamageText(multiplier, 1.25, timing),
          );
          cases++;
        }
      assert.deepEqual(damage, before);
    }
  }
  assert.equal(cases, 144);
});

test('damage display hooks restore native methods on unload', async () => {
  const { bindGameClasses } = await import('../src/game/Bindings');
  const { installDamageDescription } = await import('../src/weapon/DamageDescription');
  // @ts-expect-error actual host dispatcher
  const { Hooks } = await import('./fixtures/HostCore.js');
  class Damage {
    damage = [1, 2, 3, 4, 0];
    damageText() {
      return 'native';
    }
    debuffdamageText(_multiplier: number, _duration: number, _timing: string) {
      return 'native debuff';
    }
  }
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) =>
      name === 'core.weapon.Damage'
        ? Damage
        : name === 'generics.Localize'
          ? { t: (text: string) => text }
          : class {},
    around: (target: object, name: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(target, name, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as import('../src/api/Types').API;
  bindGameClasses(api);
  installDamageDescription(api);
  const value = new Damage();
  try {
    assert.equal(
      value.damageText(),
      damageDescription(value.damage, (text) => text),
    );
    assert.equal(
      value.debuffdamageText(2, 3, ' after'),
      debuffDamageDescription(value.damage, 2, 3, ' after', (text) => text),
    );
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(value.damageText(), 'native');
  assert.equal(value.debuffdamageText(2, 3, ' after'), 'native debuff');
});
