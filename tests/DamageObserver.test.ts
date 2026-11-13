import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DamageObserver, installDamageObserver } from '../src/telemetry/DamageObserver';
import { RollingDamageEstimate } from '../src/telemetry/RollingDamageEstimate';
import { segmentCircle } from '../src/telemetry/LocalHitGeometry';
import { defaults } from '../src/settings/Settings';

test('original rolling estimate averages full five seconds and expires buckets/partial flags', () => {
  const estimate = new RollingDamageEstimate();
  estimate.record(100, 100);
  estimate.record(400, 149);
  assert.equal(estimate.perSecond(150), 100);
  estimate.markPartial(150);
  assert.equal(estimate.isPartial(5149), true);
  assert.equal(estimate.isPartial(5150), false);
  assert.equal(estimate.perSecond(5100), 0);
  estimate.record(1000, 5200);
  assert.equal(estimate.perSecond(5200), 200);
  assert.equal(estimate.perSecond(10), 0); // wrapped/reset clock
  for (const value of [-1, 0, NaN, Infinity]) estimate.record(value, 20);
  assert.equal(estimate.perSecond(20), 0);
});

test('finite hit geometry distinguishes tangency, misses, overlaps and invalid coordinates', () => {
  assert.equal(segmentCircle(0, 0, 10, 0, 5, 0, 1), 0.4);
  assert.equal(segmentCircle(0, 0, 10, 0, 5, 1, 1), 0.5);
  assert.ok(Number.isNaN(segmentCircle(0, 0, 10, 0, 5, 2, 1)));
  assert.equal(segmentCircle(0, 0, 0, 0, 0, 0, 1), 0);
  assert.ok(Number.isNaN(segmentCircle(0, 0, Infinity, 0, 5, 0, 1)));
});

function fixture() {
  let now = 1000;
  const ship = { alive: true };
  const target = {
    alive: true,
    isHostile: true,
    invulnerable: false,
    pos: { x: 50, y: 0 },
    collisionRadius: 5,
    canBeDamage: () => true,
  };
  const game: any = { time: 1000, hud: {}, me: { ship }, unitManager: { units: [target] } };
  const config = { ...defaults };
  const weapon: any = { unit: ship, dmg: { type: 0, dmg: () => 500 } };
  const projectile: any = {
    g: game,
    ai: 'instant',
    alive: true,
    unit: ship,
    weapon,
    target,
    course: { pos: { x: 0, y: 0 }, rotation: 0 },
    pos: { x: 0, y: 0 },
    range: 100,
    collisionRadius: 1,
    numberOfHits: 1,
    dmgRadius: 0,
    clusterNrOfSplits: 0,
  };
  const observer = new DamageObserver(game, config, 6, () => now);
  return {
    observer,
    game,
    config,
    ship,
    target,
    weapon,
    projectile,
    setNow: (value: number) => (now = value),
  };
}

test('instant ray observes nearest valid contact once and rejects healing/foreign weapons', () => {
  const f = fixture();
  const farther = { ...f.target, pos: { x: 80, y: 0 } };
  f.game.unitManager.units.unshift(farther);
  const before = JSON.stringify(f.projectile);
  f.observer.activate(f.projectile);
  f.observer.activate(f.projectile);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
  assert.equal(JSON.stringify(f.projectile), before);
  f.observer.reset(f.projectile);
  f.weapon.dmg.type = 6;
  f.observer.activate(f.projectile);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
  f.weapon.dmg.type = 0;
  f.weapon.unit = {};
  f.observer.hit(f.weapon, f.target);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
});

test('homing estimates require swept contact, reject pooled target reuse, and disclose omissions', () => {
  const f = fixture();
  f.projectile.ai = 'homingMissile';
  f.observer.activate(f.projectile);
  f.projectile.course.pos.x = 20;
  f.observer.step(f.projectile, 0, 0);
  assert.equal(f.observer.estimate.perSecond(1000), 0);
  f.projectile.course.pos.x = 60;
  f.observer.step(f.projectile, 20, 0);
  f.observer.stuck(f.projectile, f.target);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
  f.observer.reset(f.projectile);
  f.observer.activate(f.projectile);
  f.observer.resetUnit(f.target);
  f.observer.step(f.projectile, 20, 0);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
  assert.equal(f.observer.estimate.isPartial(1000), true);
  f.setNow(7000);
  f.projectile.ai = 'blastwave';
  f.observer.step(f.projectile, 0, 0);
  assert.equal(f.observer.estimate.isPartial(7000), true);
  assert.equal(f.observer.estimate.perSecond(7000), 0);
});

test('homing observations follow the native lifecycle even without a local reset notification', () => {
  const f = fixture();
  let lifecycle = 1;
  Object.assign(f.target, { get_lifecycleId: () => lifecycle });
  f.projectile.ai = 'homingMissile';
  f.observer.activate(f.projectile);
  lifecycle++;
  f.projectile.course.pos.x = 60;
  f.observer.step(f.projectile, 20, 0);
  assert.equal(f.observer.estimate.perSecond(1000), 0);
  assert.equal(f.observer.estimate.isPartial(1000), true);
});

test('mine reports one closest blast contact; disabling DPS prevents collection', () => {
  const f = fixture();
  f.projectile.ai = 'mine';
  f.projectile.dmgRadius = 50;
  f.observer.explode(f.projectile);
  f.observer.explode(f.projectile);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
  f.observer.reset(f.projectile);
  f.config.show_radar_dps = false;
  f.observer.explode(f.projectile);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
});

test('beam adapter counts actual successful heat checks without consuming extra heat or changing return', () => {
  const f = fixture();
  class Heat {
    calls = 0;
    canFire() {
      return ++this.calls <= 3;
    }
  }
  class Beam {
    g = f.game;
    unit = Object.assign(f.ship, { weaponHeat: new Heat() });
    dmg = f.weapon.dmg;
    target = f.target;
    secondaryTargets = [{}];
    fireNextTime = 0;
    lastFire = 0;
    reloadTime = 10;
    shoot() {
      for (let i = 0; i < 8; i++) if (!this.unit.weaponHeat.canFire()) return 'overheated';
      return 'fired';
    }
  }
  const classes: any = {
    'core.weapon.Heat': Heat,
    'core.weapon.Beam': Beam,
    'core.weapon.Damage': { HEAL: 6 },
  };
  const cleanups: Function[] = [];
  const api: any = {
    cls: (name: string) => classes[name],
    around(target: any, name: string, hook: Function) {
      const original = target[name];
      target[name] = function (...args: any[]) {
        return hook.call(this, original.bind(this), ...args);
      };
      cleanups.push(() => (target[name] = original));
    },
    after(target: any, name: string, hook: Function) {
      this.around(target, name, function (this: any, next: Function, ...args: any[]) {
        const result = next(...args);
        hook.call(this, result, ...args);
        return result;
      });
    },
  };
  class ContactFixture {
    canBeDamage() {
      return false;
    }
    destroy() {}
    explode() {}
    enter() {}
    execute() {}
  }
  api.before = (target: object, name: string, hook: Function) => {
    api.around(target, name, function (this: object, next: Function, ...args: unknown[]) {
      hook.apply(this, args);
      return next(...args);
    });
  };
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? ContactFixture });
  const contacts: unknown[] = [];
  const observer = installDamageObserver(api, f.game, f.config, (target) => contacts.push(target));
  const beam = new Beam();
  assert.equal(beam.shoot(), 'overheated');
  assert.equal(beam.unit.weaponHeat.calls, 4);
  assert.equal(observer.estimate.perSecond(observer.now()), 300);
  assert.equal(observer.estimate.isPartial(observer.now()), true);
  assert.deepEqual(contacts, [f.target]);
  contacts.length = 0;
  f.config.show_radar_dps = false;
  beam.unit.weaponHeat.calls = 0;
  assert.equal(beam.shoot(), 'overheated');
  assert.equal(beam.unit.weaponHeat.calls, 4);
  assert.deepEqual(contacts, [f.target]);
  assert.equal(observer.estimate.perSecond(observer.now()), 300);
  cleanups.reverse().forEach((cleanup) => cleanup());
});

test('native bullet contact coverage never enables the separate mine blast estimator', () => {
  const f = fixture();
  f.observer.contactFamilies.add('bullet');
  f.projectile.ai = 'bullet';
  f.projectile.pos.x = 50;
  f.observer.activate(f.projectile);
  assert.equal(f.observer.estimate.isPartial(1000), false);
  f.observer.explode(f.projectile);
  assert.equal(f.observer.estimate.perSecond(1000), 0);
  f.observer.hit(f.weapon, f.target);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
});

test('server retarget refreshes estimate lifecycle without allowing repeated damage claims', () => {
  const f = fixture();
  f.projectile.ai = 'homingMissile';
  f.observer.activate(f.projectile);
  const replacement = { ...f.target, pos: { x: 50, y: 0 }, get_lifecycleId: () => 7 };
  f.projectile.target = replacement;
  f.projectile.course.pos.x = 60;
  f.observer.step(f.projectile, 20, 0);
  assert.equal(f.observer.estimate.perSecond(1000), 0);
  f.observer.captureTarget(f.projectile);
  f.observer.step(f.projectile, 20, 0);
  assert.equal(f.observer.estimate.perSecond(1000), 100);
  f.observer.captureTarget(f.projectile);
  f.observer.step(f.projectile, 20, 0);
  assert.equal(f.observer.estimate.perSecond(1000), 100, 'retarget must not reset one-hit claim');
});
