import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DamageObserver } from '../src/telemetry/DamageObserver';
import { defaults } from '../src/settings/Settings';
// @ts-expect-error original AS3 method execution boundary
import { install } from './fixtures/As3Methods.js';

test('DPS eligibility and recording match original weapon methods across ownership and UI lifetime', () => {
  const source = readFileSync(
    new URL('./fixtures/weapon/Weapon.as', import.meta.url),
    'utf8',
  ).replace(/\/\/[^\n]*/g, '');
  let cases = 0;
  for (const owner of ['self', 'pet', 'enemy'] as const)
    for (const leaving of [false, true])
      for (const enabled of [false, true])
        for (const hasHud of [false, true])
          for (const amount of [-1, 0, 500, NaN, Infinity])
            for (const heal of [false, true]) {
              const ship = { isHostile: false };
              const unit =
                owner === 'self'
                  ? ship
                  : { owner: owner === 'pet' ? ship : null, isHostile: false };
              const target = { alive: true, invulnerable: false, isHostile: true, owner: null };
              const config = { ...defaults, show_radar_dps: enabled };
              let expectedDamage = 0,
                expectedPartial = false;
              const hud = {
                recordEstimatedDamage: (value: number) => {
                  expectedDamage += value;
                },
                markDamageEstimatePartial: () => {
                  expectedPartial = true;
                },
              };
              const game = { me: { ship }, isLeaving: leaving, hud: hasHud ? hud : null };
              const weapon = { unit, dmg: { type: heal ? 6 : 0, dmg: () => amount } };
              const original = {
                ...weapon,
                g: game,
                Damage: { HEAL: 6 },
                SceneBase: { clientSettings: { showRadarDPS: enabled } },
                canEstimateDamage: (): boolean => false,
                recordEstimatedHit: (_target: object): void => {},
                markDamageEstimatePartial: (): void => {},
              };
              install(original, source, [
                'canEstimateDamage',
                'recordEstimatedHit',
                'markDamageEstimatePartial',
              ]);
              const observer = new DamageObserver(game, config, 6, () => 1000);
              const context = JSON.stringify({ owner, leaving, enabled, hasHud, amount, heal });
              assert.equal(observer.canEstimate(weapon), original.canEstimateDamage(), context);
              original.recordEstimatedHit(target);
              original.markDamageEstimatePartial();
              observer.hit(weapon, target);
              observer.partial(weapon);
              assert.equal(observer.estimate.perSecond(1000), expectedDamage / 5, context);
              assert.equal(observer.estimate.isPartial(1000), expectedPartial, context);
              cases++;
            }
  assert.equal(cases, 240);
});

test('actual hit history and target offers match original independently of estimate collection', () => {
  const source = readFileSync(
    new URL('./fixtures/weapon/Weapon.as', import.meta.url),
    'utf8',
  ).replace(/\/\/[^\n]*/g, '');
  let cases = 0;
  for (const owner of ['self', 'pet', 'enemy'] as const)
    for (const leaving of [false, true])
      for (const includeEstimate of [false, true])
        for (const heal of [false, true])
          for (const hasTarget of [false, true]) {
            const ship = { isHostile: false };
            const unit = owner === 'self' ? ship : { owner: owner === 'pet' ? ship : null };
            const target = hasTarget ? { alive: true, invulnerable: false, isHostile: true } : null;
            const expectedTargets: object[] = [],
              observedTargets: object[] = [];
            let expectedDamage = 0;
            const game = {
              me: { ship },
              isLeaving: leaving,
              hud: {
                recordEstimatedDamage: (value: number) => {
                  expectedDamage += value;
                },
              },
              targetSystem: { tryAutoTarget: (value: object) => expectedTargets.push(value) },
            };
            const weapon = { unit, dmg: { type: heal ? 6 : 0, dmg: () => 500 } };
            const original = {
              ...weapon,
              g: game,
              Damage: { HEAL: 6 },
              SceneBase: { clientSettings: { showRadarDPS: true } },
              _lastSimulatedHitUnit: null as object | null,
              _lastSimulatedHitTime: 0,
              getTimer: () => 1000,
              // Incoming NPC damage belongs to the separate incoming adapter.
              recordIncomingHit: (_target: object | null) => {},
              canEstimateDamage: (): boolean => false,
              recordEstimatedHit: (_target: object | null): void => {},
              registerSimulatedHit: (_target: object | null, _include: boolean): void => {},
            };
            install(original, source, [
              'canEstimateDamage',
              'recordEstimatedHit',
              'registerSimulatedHit',
            ]);
            const observer = new DamageObserver(
              game,
              { ...defaults, show_radar_dps: true },
              6,
              () => 1000,
              (value) => observedTargets.push(value),
            );
            original.registerSimulatedHit(target, includeEstimate);
            observer.contact(weapon, target, includeEstimate);
            const context = JSON.stringify({ owner, leaving, includeEstimate, heal, hasTarget });
            assert.deepEqual(observedTargets, expectedTargets, context);
            assert.equal(
              observer.lastContact(weapon)?.unit ?? null,
              original._lastSimulatedHitUnit,
              context,
            );
            assert.equal(
              observer.lastContact(weapon)?.time ?? 0,
              original._lastSimulatedHitTime,
              context,
            );
            assert.equal(observer.estimate.perSecond(1000), expectedDamage / 5, context);
            cases++;
          }
  assert.equal(cases, 48);
});
