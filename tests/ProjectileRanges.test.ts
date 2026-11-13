import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installProjectileRanges } from '../src/projectile/ProjectileRanges';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';
// @ts-expect-error captured native Haxe method
import { createNativeProjectileInitialize } from './fixtures/NativeProjectileInitialize.js';

class Point {
  constructor(
    public x = 0,
    public y = 0,
  ) {}
  get_length() {
    return Math.hypot(this.x, this.y);
  }
}

test('native initialization sees fresh pooled ranges and server ray length before catch-up', () => {
  const seen: Array<{ range: number; speed: number }> = [];
  const weapon = {
    range: 500,
    multiNrOfP: 1,
    multiOffset: 0,
    positionOffsetX: 0,
    playFireSound() {},
  };
  const unit = { weaponPos: { x: 0, y: 0 }, get_pos: () => new Point(), get_rotation: () => 0 };
  const heading = { pos: new Point() };
  class Shot {
    range = 9999;
    speedMax = 0;
    collisionRadius = 2;
    weapon = weapon;
    instant = true;
    course = heading;
    stateMachine = { inState: (name: string) => this.instant && name === 'Instant' };
    set_id(_id: number) {}
    set_rotation(_value: number) {}
    set_x(_value: number) {}
    set_y(_value: number) {}
    fastforward() {
      seen.push({ range: this.range, speed: this.speedMax });
    }
  }
  const reused = new Shot();
  const factory = {
    create(_key: string, _game: object, _unit: object, _weapon: typeof weapon) {
      return reused;
    },
  };
  class Manager {
    activated = 0;
    activateProjectile(_shot: Shot) {
      this.activated++;
    }
    declare createSetProjectile: (
      shot: Shot,
      id: number,
      owner: typeof unit,
      course: typeof heading,
      index: number,
      x?: number,
      y?: number,
      speed?: number,
    ) => void;
  }
  Manager.prototype.createSetProjectile = createNativeProjectileInitialize(Point);
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const classes: Record<string, unknown> = {
    'core.projectile.ProjectileFactory': factory,
    'core.projectile.ProjectileManager': Manager,
  };
  const register = (kind: string) => (owner: object, key: string, callback: unknown) => {
    const off = hooks.add(owner, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    after: register('after'),
    around: register('around'),
  } as unknown as API;
  bindGameClasses(api);
  installProjectileRanges(api);
  const manager = new Manager();
  try {
    for (const [range, override, expected] of [
      [500, 250, 250],
      [800, 0, 800],
      [300, -1, 300],
      [400, NaN, 400],
      [NaN, 0, 0],
      [Infinity, 0, 0],
    ]) {
      weapon.range = range;
      reused.range = 9999;
      reused.speedMax = 0;
      const shot = factory.create('ray', {}, unit, weapon);
      manager.createSetProjectile(shot, 1, unit, heading, -1, 0, 0, override);
      assert.deepEqual(seen.at(-1), { range: expected, speed: 10000 });
    }
    reused.instant = false;
    reused.speedMax = 123;
    manager.createSetProjectile(reused, 1, unit, heading, -1, 0, 0, 456);
    assert.equal(seen.at(-1)!.speed, 456, 'ordinary speed override is retained');
    manager.createSetProjectile(reused, 1, unit, heading, -1, 0, 0, NaN);
    assert.equal(seen.at(-1)!.speed, 456, 'nonfinite override cannot poison movement');
    assert.equal(manager.activated, 8);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  reused.range = 777;
  factory.create('ray', {}, unit, weapon);
  assert.equal(reused.range, 777, 'unload restores factory');
});
