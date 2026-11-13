import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type Ship as NativeShip } from '../src/game/Bindings';
import { installShipPoseHistory, sampleShipPose } from '../src/rendering/Interpolation';
// @ts-expect-error exercise the real host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('orbit heading replacement retains the tick endpoints; relocation and pooling clear them', () => {
  const heading = (x: number) => ({
    pos: { x, y: 0 },
    speed: { x: 1000, y: 0 },
    rotation: 0,
    rotateLeft: false,
    rotateRight: false,
  });
  class Ship {
    course = heading(0);
    engine = null;
    changeState = false;
    fail = false;
    get_course() {
      return this.course;
    }
    get_pos() {
      return this.course.pos;
    }
    set_course(value: ReturnType<typeof heading>) {
      this.course = value;
    }
    initCourse(value: ReturnType<typeof heading>) {
      this.course = value;
    }
    reset() {}
    update() {
      if (this.changeState) this.set_course(heading(this.course.pos.x));
      if (this.fail) throw new Error('native update failed');
      this.course.pos.x += 33;
    }
  }
  class Enemy extends Ship {}
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const remove = hooks.add(target, key, kind, callback);
    cleanups.push(remove);
    return remove;
  };
  const api = {
    cls: (name: string) =>
      name === 'core.ship.Ship' ? Ship : name === 'core.ship.EnemyShip' ? Enemy : { prototype: {} },
    before: hook('before'),
    around: hook('around'),
    defer: (remove: () => void) => {
      cleanups.push(remove);
      return remove;
    },
  } as unknown as API;
  bindGameClasses(api);
  const history = installShipPoseHistory(api);
  const enemy = new Enemy();
  const native = enemy as unknown as NativeShip;
  const render = (alpha: number) =>
    sampleShipPose(enemy, history.previous.get(native), alpha, history.completed.get(native))?.x;
  try {
    enemy.update();
    assert.equal(render(0.5), 16.5);
    enemy.changeState = true;
    enemy.update();
    assert.equal(render(0), 33, 'AIOrbit exit keeps the preceding completed position');
    assert.equal(render(0.5), 49.5);
    assert.equal(render(1), 66);
    assert.equal(enemy.course.pos.x, 66, 'rendering does not alter simulation');
    // Native enemy packets mutate the current course between simulation ticks.
    // The already-started display interval must keep both captured endpoints.
    enemy.course.pos.x = 166;
    assert.equal(render(0.5), 49.5, 'packet arrival cannot rewrite the active render interval');
    assert.equal(render(0.75), 57.75);
    enemy.update();
    assert.equal(render(0), 66, 'next interval begins at the last completed endpoint');
    assert.equal(render(0.5), 132.5);
    assert.equal(render(1), 199, 'the next completed step incorporates authoritative correction');
    assert.equal(enemy.course.pos.x, 199, 'correction remains owned by simulation');
    enemy.set_course(heading(8000));
    assert.equal(render(0), 8000, 'out-of-step relocation cannot blend from the old orbit');
    enemy.update();
    enemy.initCourse(heading(9000));
    assert.equal(render(0), 9000, 'spawn initialization also discards old endpoints');
    enemy.update();
    enemy.reset();
    assert.equal(history.previous.has(native), false);
    assert.equal(history.completed.has(native), false);
    enemy.fail = true;
    assert.throws(() => enemy.update(), /native update failed/);
    enemy.set_course(heading(10000));
    assert.equal(render(0), 10000, 'failed updates release their in-step guard');
  } finally {
    cleanups.reverse().forEach((remove) => remove());
  }
  assert.equal(Object.hasOwn(Enemy.prototype, 'update'), false);
});
