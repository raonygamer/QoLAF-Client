import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
// @ts-expect-error original AS3 execution boundary
import { install } from './fixtures/As3Methods.js';
// @ts-expect-error captured native Haxe method
import { hasWeaponInFleet } from './fixtures/landed/NativePirateFleet.js';

test('current Pirate Bay fleet filtering matches the original client without a replacement hook', () => {
  const source = readFileSync(
    new URL('./fixtures/landed/LandedPiratebay.as', import.meta.url),
    'utf8',
  );
  const ships = [
    [],
    [{ weapon: 'alpha' }],
    [{ weapon: 'beta' }, { weapon: 'alpha' }],
    [{ weapon: 'gamma' }],
  ];
  for (const first of ships)
    for (const second of ships)
      for (const third of ships)
        for (const query of ['alpha', 'beta', 'gamma', 'absent', '']) {
          const fleet = [first, second, third].map((weapons) => ({ weapons }));
          const original = {
            g: { me: { fleet } },
            hasWeaponInFleet(_key: string): boolean {
              return false;
            },
          };
          install(original, source, ['hasWeaponInFleet']);
          const native = { g: { get_me: () => ({ fleet }) } };
          const before = JSON.stringify(fleet);
          assert.equal(hasWeaponInFleet.call(native, query), original.hasWeaponInFleet(query));
          assert.equal(JSON.stringify(fleet), before);
        }
  assert.equal(hasWeaponInFleet.call({ g: { get_me: () => ({ fleet: [] }) } }, 'alpha'), false);
});
