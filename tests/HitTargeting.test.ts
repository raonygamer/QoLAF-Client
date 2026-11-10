import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DamageObserver } from '../src/Telemetry/DamageObserver';
import { TargetSystem } from '../src/Target/TargetSystem';
import { defaults } from '../src/Settings/Settings';

function setup() {
  const ship = { alive: true, pos: { x: 0, y: 0 } };
  const enemy = {
    alive: true,
    isHostile: true,
    pos: { x: 50, y: 0 },
    collisionRadius: 5,
    canBeDamage: () => true,
  };
  const game = { me: { ship }, unitManager: { units: [enemy] } };
  const config = { ...defaults, show_radar_dps: false };
  const targets = new TargetSystem(game, config);
  const weapon = { unit: ship, dmg: { type: 0, dmg: () => 500 } };
  const observer = new DamageObserver(
    game,
    config,
    6,
    () => 1000,
    (target) => targets.auto(target),
  );
  return { ship, enemy, game, config, targets, weapon, observer };
}

test('personal direct hits select targets while honoring locks, cooldown, exclusion and settings', () => {
  const f = setup();
  f.observer.contact(f.weapon, f.enemy);
  assert.equal(f.targets.current, f.enemy);
  assert.equal(f.observer.estimate.perSecond(1000), 0);
  const other = { ...f.enemy, pos: { x: 70, y: 0 } };
  f.observer.contact(f.weapon, other);
  assert.equal(f.targets.current, f.enemy); // source half-second cooldown
  f.targets.update(0.5);
  f.targets.locked = true;
  f.observer.contact(f.weapon, other);
  assert.equal(f.targets.current, f.enemy);
  f.targets.clear(true);
  f.config.auto_target = false;
  f.observer.contact(f.weapon, other);
  assert.equal(f.targets.current, null);
  f.config.auto_target = true;
  f.observer.contact(f.weapon, { ...other, hasFaction: () => true });
  assert.equal(f.targets.current, null);
  f.observer.contact(f.weapon, { ...other, pos: { x: 10000, y: 0 } });
  assert.equal(f.targets.current, null);
  f.observer.contact(f.weapon, other);
  assert.equal(f.targets.current, other);
});

test('pet hits select but healing and foreign weapons never record a personal last hit', () => {
  const f = setup();
  const pet = { ...f.weapon, unit: { owner: f.ship } };
  f.observer.contact(pet, f.enemy);
  assert.equal(f.targets.current, f.enemy);
  assert.equal(f.observer.lastContact(pet)?.unit, f.enemy);
  f.targets.clear(true);
  const healing = { ...f.weapon, dmg: { ...f.weapon.dmg, type: 6 } };
  const foreign = { ...f.weapon, unit: {} };
  for (const weapon of [healing, foreign]) {
    f.observer.contact(weapon, f.enemy);
    assert.equal(f.observer.lastContact(weapon), undefined);
  }
  assert.equal(f.targets.current, null);
});

test('inferred rays/homing geometry do not auto-target; native sticking does even after an estimated hit', () => {
  const f = setup();
  f.config.show_radar_dps = true;
  const projectile: any = {
    g: f.game,
    ai: 'instant',
    alive: true,
    unit: f.ship,
    weapon: f.weapon,
    target: f.enemy,
    course: { pos: { x: 0, y: 0 }, rotation: 0 },
    range: 100,
    collisionRadius: 1,
    numberOfHits: 1,
    dmgRadius: 0,
    clusterNrOfSplits: 0,
  };
  f.observer.activate(projectile);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
  assert.equal(f.targets.current, null);
  assert.equal(f.observer.lastContact(f.weapon), undefined);
  f.observer.reset(projectile);
  projectile.ai = 'homingMissile';
  f.observer.activate(projectile);
  projectile.course.pos.x = 60;
  f.observer.step(projectile, 0, 0);
  assert.equal(f.targets.current, null);
  assert.equal(f.observer.estimate.perSecond(1000), 200);
  f.observer.stuck(projectile, f.enemy);
  assert.equal(f.targets.current, f.enemy);
  assert.equal(f.observer.estimate.perSecond(1000), 200);
});

test('mine blast contacts select independently of DPS and do not repeat on duplicate explosions', () => {
  const f = setup();
  const mine = {
    g: f.game,
    ai: 'mine',
    alive: true,
    unit: f.ship,
    weapon: f.weapon,
    pos: { x: 0, y: 0 },
    dmgRadius: 50,
  };
  f.observer.explode(mine);
  assert.equal(f.targets.current, f.enemy);
  f.targets.clear(true);
  f.observer.explode(mine);
  assert.equal(f.targets.current, null);
  assert.equal(f.observer.estimate.perSecond(1000), 0);
});

test('weapon reuse clears contact history without erasing other weapons or target state', () => {
  const f = setup();
  const secondWeapon = { ...f.weapon };
  f.observer.contact(f.weapon, f.enemy);
  f.observer.contact(secondWeapon, f.enemy);
  f.observer.resetWeapon(f.weapon);
  assert.equal(f.observer.lastContact(f.weapon), undefined);
  assert.equal(f.observer.lastContact(secondWeapon)?.unit, f.enemy);
  assert.equal(f.targets.current, f.enemy);
});
