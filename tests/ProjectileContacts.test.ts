import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installProjectileContacts } from '../src/telemetry/ProjectileContacts';
import { DamageObserver } from '../src/telemetry/DamageObserver';
import { defaults } from '../src/settings/Settings';
import {
  createProjectileBulletExecute,
  createBouncingExecute,
} from './fixtures/NativeProjectileContacts.js';

function setup(family = 'bullet', hits = 1, bomb = false, positions = [5]) {
  class Unit {
    alive = true;
    invulnerable = false;
    isHostile = true;
    collisionRadius = 2;
    lastBulletGlobal = 0;
    lastBulletLocal = 0;
    lastBulletTargetList: any = null;
    eligible = true;
    constructor(readonly pos: { x: number; y: number }) {}
    get_pos() {
      return this.pos;
    }
    canBeDamage() {
      return this.eligible;
    }
  }
  const ship = new Unit({ x: 0, y: 0 });
  ship.isHostile = false;
  const targets = positions.map((value) => new Unit({ x: value, y: value }));
  const game: any = { time: 1000, me: { ship }, unitManager: { units: targets } };
  const weapon: any = { unit: ship, dmg: { type: 0, dmg: () => 500 }, weaponDebuffs: [] };
  class Projectile {
    g = game;
    unit = ship;
    weapon = weapon;
    ai = family;
    alive = true;
    aiTargetSelf = false;
    isBomb = bomb;
    numberOfHits = hits;
    collisionRadius = 1;
    convergenceTime = 1;
    convergenceCounter = 1;
    error = null;
    oldPos = { x: 0, y: 0 };
    course = { pos: { x: 0, y: 0 } };
    speedMax = 100;
    explosions = 0;
    removals = 0;
    target: any = null;
    updateHeading() {
      this.course.pos.x += 10;
      this.course.pos.y += 10;
    }
    explode() {
      this.explosions++;
      return 'explosion';
    }
    destroy() {
      this.removals++;
      this.explode();
      this.alive = false;
      return 'destroyed';
    }
  }
  class Stuck {
    constructor(
      public m: any,
      public p: any,
      public stuckUnit: any,
    ) {
      p.target = stuckUnit;
    }
    enter() {
      return 'stuck';
    }
  }
  const bulletExecute = createProjectileBulletExecute(Stuck);
  const bouncingExecute = createBouncingExecute(Stuck);
  class Bullet {
    m = game;
    p: Projectile;
    isEnemy = false;
    nextLocalUpdate = 0;
    nextGlobalUpdate = 0;
    localTargetList: Unit[] = [];
    localRangeSQ = 1000000;
    firstUpdate = true;
    sm = { changeState: (state: any) => state.enter() };
    constructor(projectile: Projectile) {
      this.p = projectile;
    }
    execute() {
      return bulletExecute.call(this);
    }
  }
  class Bouncing extends Bullet {
    execute() {
      return bouncingExecute.call(this);
    }
  }
  const projectile = new Projectile();
  const state = new (family === 'bouncing' ? Bouncing : Bullet)(projectile);
  const classes: any = {
    'core.unit.Unit': Unit,
    'core.projectile.Projectile': Projectile,
    'core.states.aistates.ProjectileStuck': Stuck,
    'core.states.aistates.ProjectileBullet': Bullet,
    'core.states.aistates.Bouncing': Bouncing,
  };
  const cleanups: Function[] = [];
  const api: any = {
    cls: (name: string) => classes[name],
    around(object: any, name: string, hook: Function) {
      const original = object[name];
      object[name] = function (...args: any[]) {
        return hook.call(this, original.bind(this), ...args);
      };
      cleanups.push(() => (object[name] = original));
    },
    before(object: any, name: string, hook: Function) {
      this.around(object, name, function (this: any, next: Function, ...args: any[]) {
        hook.apply(this, args);
        return next(...args);
      });
    },
    after(object: any, name: string, hook: Function) {
      this.around(object, name, function (this: any, next: Function, ...args: any[]) {
        const result = next(...args);
        hook.call(this, result, ...args);
        return result;
      });
    },
  };
  const config = { ...defaults };
  const contacts: any[] = [];
  const observer = new DamageObserver(
    game,
    config,
    6,
    () => 1000,
    (target) => contacts.push(target),
  );
  const snapshot = () => ({
    pos: { ...projectile.course.pos },
    alive: projectile.alive,
    explosions: projectile.explosions,
    removals: projectile.removals,
    numberOfHits: projectile.numberOfHits,
    targetIndex: targets.indexOf(projectile.target),
    nextLocalUpdate: state.nextLocalUpdate,
    nextGlobalUpdate: state.nextGlobalUpdate,
  });
  return {
    config,
    contacts,
    state,
    projectile,
    targets,
    observer,
    snapshot,
    install: () => installProjectileContacts(api, game, observer),
    cleanup: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('actual native bullet collisions report once through destroy/explode without changing simulation', () => {
  const baseline = setup();
  const expectedResult = baseline.state.execute();
  const observed = setup();
  observed.install();
  assert.equal(observed.state.execute(), expectedResult);
  assert.deepEqual(observed.snapshot(), baseline.snapshot());
  assert.equal(observed.observer.estimate.perSecond(1000), 100);
  assert.equal(observed.projectile.explosions, 1);
  observed.cleanup();
});

test('native piercing contacts count distinct collision branches and bomb contact counts on sticking', () => {
  for (const [hits, bomb, positions, damage] of [
    [10, false, [4, 6], 200],
    [1, true, [5], 100],
  ] as const) {
    const baseline = setup('bullet', hits, bomb, [...positions]);
    baseline.state.execute();
    const observed = setup('bullet', hits, bomb, [...positions]);
    observed.install();
    observed.state.execute();
    assert.deepEqual(observed.snapshot(), baseline.snapshot());
    assert.equal(observed.observer.estimate.perSecond(1000), damage);
    observed.cleanup();
  }
});

test('eligible misses, expired projectiles and rejected candidates do not become damage', () => {
  const observed = setup('bullet', 1, false, [100]);
  observed.install();
  observed.state.execute();
  assert.equal(observed.projectile.alive, true);
  assert.equal(observed.projectile.destroy(), 'destroyed'); // lifetime/server removal outside contact scan
  assert.equal(observed.observer.estimate.perSecond(1000), 0);
  observed.cleanup();
  const rejected = setup();
  rejected.targets[0].eligible = false;
  rejected.install();
  rejected.state.execute();
  assert.equal(rejected.observer.estimate.perSecond(1000), 0);
  assert.equal(rejected.projectile.alive, true);
  rejected.cleanup();
});

test('native bouncing eligibility behavior remains unchanged, with no invented hostile collision', () => {
  const baseline = setup('bouncing');
  baseline.state.execute();
  const observed = setup('bouncing');
  observed.install();
  observed.state.execute();
  assert.deepEqual(observed.snapshot(), baseline.snapshot());
  assert.equal(observed.observer.contactFamilies.has('bouncing'), true);
  assert.equal(observed.observer.estimate.perSecond(1000), 0);
  assert.equal(observed.projectile.alive, true);
  observed.cleanup();
});

test('throwing native collision scans release their candidate and preserve the original exception', () => {
  const observed = setup();
  const error = new Error('native position lookup failed');
  observed.targets[0].get_pos = () => {
    throw error;
  };
  observed.install();
  assert.throws(
    () => observed.state.execute(),
    (value) => value === error,
  );
  observed.projectile.destroy();
  assert.equal(observed.observer.estimate.perSecond(1000), 0);
  observed.cleanup();
});

test('disposing contact hooks restores native methods and stops recording subsequent collisions', () => {
  const observed = setup();
  observed.install();
  observed.cleanup();
  observed.state.execute();
  assert.equal(observed.projectile.removals, 1);
  assert.equal(observed.observer.estimate.perSecond(1000), 0);
});

test('native bullet hits offer auto-targets with the DPS display disabled', () => {
  const observed = setup();
  observed.config.show_radar_dps = false;
  observed.install();
  observed.state.execute();
  assert.deepEqual(observed.contacts, [observed.targets[0]]);
  assert.deepEqual(observed.observer.lastContact(observed.projectile.weapon), {
    unit: observed.targets[0],
    time: 1000,
  });
  assert.equal(observed.observer.estimate.perSecond(1000), 0);
  observed.cleanup();
});
