import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installEnemyCourseOwnership } from '../src/movement/EnemyCourseOwnership';
// @ts-expect-error production dispatcher
import { Hooks } from './fixtures/HostCore.js';
// @ts-expect-error captured native implementation
import { createSetTarget } from './fixtures/NativeEnemyConverge.js';

test('native enemy blending cannot mutate the authoritative heading through shared points', () => {
  class Point {
    constructor(
      public x = 0,
      public y = 0,
    ) {}
  }
  class Enemy {}
  const heading = (x: number, y: number) => ({
    pos: new Point(x, y),
    speed: new Point(20, 40),
    time: 1000,
    rotation: 1,
    accelerate: true,
    deaccelerate: false,
    rotateLeft: false,
    rotateRight: true,
  });
  type Heading = ReturnType<typeof heading>;
  class Converger {
    ship: object = new Enemy();
    course = heading(90, 190);
    target: Heading | null = null;
    blends: unknown[][] = [];
    calls = 0;
    declare setConvergeTarget: (target: Heading) => void;
    carriedVelocity() {
      return new Point(22, 43);
    }
    removeLead() {}
    startBlend(...args: unknown[]) {
      this.blends.push(args);
    }
    aiAddError(value: Heading) {
      this.calls++;
      value.pos.x += 5;
      value.pos.y -= 3;
      value.rotation += 0.2;
    }
  }
  Converger.prototype.setConvergeTarget = createSetTarget(Enemy, Point);
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) =>
      ({
        'core.sync.Converger': Converger,
        'core.ship.EnemyShip': Enemy,
        'openfl.geom.Point': Point,
      })[name] ?? {},
    before(owner: object, key: string, callback: unknown) {
      const off = hooks.add(owner, key, 'before', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  const vanilla = new Converger();
  const vanillaTarget = heading(100, 200);
  vanilla.setConvergeTarget(vanillaTarget);
  assert.equal(vanillaTarget.pos.x, 105, 'fixture reproduces native snapshot mutation');
  installEnemyCourseOwnership(api);
  try {
    const patched = new Converger();
    const target = heading(100, 200);
    const snapshot = structuredClone(target);
    patched.setConvergeTarget(target);
    assert.deepEqual(structuredClone(target), snapshot);
    assert.deepEqual(patched.course, vanilla.course, 'native blend result is retained');
    assert.deepEqual(patched.blends, vanilla.blends, 'native blend inputs are retained');
    assert.equal(patched.calls, 1);
    assert.notEqual(patched.course.pos, target.pos);
    assert.notEqual(patched.course.speed, target.speed);
    patched.course.speed.x += 9;
    assert.equal(target.speed.x, 20);
    const point = patched.course.pos;
    patched.aiAddError(patched.course);
    assert.equal(patched.course.pos, point, 'no per-frame reallocation after detachment');
    const player = new Converger();
    player.ship = {};
    player.target = target;
    player.course = { ...target };
    player.aiAddError(player.course);
    assert.equal(player.course.pos, target.pos, 'player reconciliation is unaffected');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const restored = new Converger();
  const target = heading(100, 200);
  restored.setConvergeTarget(target);
  assert.equal(restored.course.pos, target.pos);
});
