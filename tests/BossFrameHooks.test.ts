import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBossFrames } from '../src/rendering/BossFrames';
// @ts-expect-error exercise the host dispatcher, including inherited methods
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  class Display {
    x = 0;
    y = 0;
    rotation = 0;
    set_x(value: number) {
      this.x = value;
    }
    set_y(value: number) {
      this.y = value;
    }
    set_rotation(value: number) {
      this.rotation = value;
    }
    get_x() {
      return this.x;
    }
    get_y() {
      return this.y;
    }
  }
  const game = { gameStateMachine: { accumulator: 16.5 } };
  class Unit {
    g = game;
    alive = true;
    active = true;
    x = 0;
    y = 0;
    rotation = 0;
    _mc = new Display();
    hpBar = new Display();
    shieldBar = new Display();
    miniBarsAreAddedToCanvas = true;
    get_x() {
      return this.x;
    }
    get_y() {
      return this.y;
    }
    get_rotation() {
      return this.rotation;
    }
    set_x(value: number) {
      this.x = value;
    }
    set_y(value: number) {
      this.y = value;
    }
    update() {}
    reset() {}
    draw() {
      this._mc.set_x(this.x);
      this._mc.set_y(this.y);
      this._mc.set_rotation(this.rotation);
      this.hpBar.set_y(this.y - 10);
      this.shieldBar.set_y(this.y - 15);
    }
  }
  class Boss extends Unit {
    awaitingActivation = false;
    course = { pos: { x: 1000, y: 2000 }, rotation: 0 };
    overrideConvergeTarget(x: number, y: number) {
      this.course.pos = { x, y };
    }
  }
  class Part extends Unit {
    parentObj = new Boss();
    offset = { x: 50, y: 0 };
    angleOffset = 0;
  }
  class Spawner extends Part {}
  class Component extends Part {
    currentAngleOffset = 0;
    imageAngle = 0;
    effectX = 10;
    effectY = 0;
    effectTarget = new Display();
  }
  class Turret extends Part {
    aimArc = 0;
    forcedRotation = false;
    startAngle = 0.2;
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const cleanup = hooks.add(target, key, kind, callback);
    cleanups.push(cleanup);
    return cleanup;
  };
  const classes = {
    'core.boss.Boss': Boss,
    'core.boss.BossComponent': Component,
    'core.spawner.Spawner': Spawner,
    'core.turret.Turret': Turret,
  };
  const api = {
    cls: (name: string) => Reflect.get(classes, name) ?? {},
    before: hook('before'),
    after: hook('after'),
    defer: (cleanup: () => void) => {
      cleanups.push(cleanup);
      return cleanup;
    },
  } as unknown as API;
  bindGameClasses(api);
  installBossFrames(api);
  return {
    Boss,
    Component,
    Spawner,
    Turret,
    Unit,
    game,
    dispose: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('boss hooks interpolate inherited draw methods, turret aim, teleport, and clean up', () => {
  const f = fixture();
  try {
    const boss = new f.Boss();
    boss.x = 1000;
    boss.y = 2000;
    boss.update();
    boss.x = 1032;
    boss.y = 2000;
    boss.update();
    const turret = new f.Turret();
    turret.parentObj = boss;
    turret.x = 1082;
    turret.y = 2000;
    turret.draw();
    assert.equal(turret._mc.x, 1066);
    assert.equal(turret._mc.rotation, 0.2);
    assert.equal(turret.hpBar.y, 1990);
    turret.aimArc = 1;
    turret.rotation = Math.PI - 0.1;
    turret.update();
    turret.rotation = -Math.PI + 0.1;
    turret.draw();
    assert.ok(Math.abs(turret._mc.rotation - Math.PI) < 1e-9);
    const component = new f.Component();
    component.parentObj = boss;
    component.x = 1082;
    component.y = 2000;
    component.draw();
    assert.equal(component._mc.x, 1066);
    assert.equal(component.effectTarget.x, 1076);
    boss.overrideConvergeTarget(8000, 9000);
    turret.draw();
    assert.equal(turret._mc.x, 8050);
    assert.equal(turret._mc.y, 9000);
  } finally {
    f.dispose();
  }
  assert.equal(Object.hasOwn(f.Boss.prototype, 'get_renderX'), false);
  assert.equal(Object.hasOwn(f.Turret.prototype, 'draw'), false);
  const turret = new f.Turret();
  turret.x = 20;
  turret.draw();
  assert.equal(turret._mc.x, 20);
});

test('rotating multipart mounts, bars and effect anchors follow one pose without frame drift', () => {
  const f = fixture();
  const close = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  try {
    const boss = new f.Boss();
    boss.x = 1000;
    boss.y = 2000;
    boss.update();
    boss.x = 1032;
    boss.y = 2064;
    boss.rotation = Math.PI / 2;
    boss.update();
    const component = new f.Component();
    const spawner = new f.Spawner();
    const turret = new f.Turret();
    for (const part of [component, spawner, turret]) {
      part.parentObj = boss;
      part.offset = { x: 40, y: -20 };
      // Simulation position is the completed tick, not the interpolated mount.
      part.x = 1052;
      part.y = 2104;
    }
    component.currentAngleOffset = 6;
    component.update();
    component.currentAngleOffset = 6.5;
    component.imageAngle = 0.3;
    component.effectX = 12;
    component.effectY = -8;
    spawner.angleOffset = 0.4;
    turret.forcedRotation = true;
    turret.rotation = 0.7;
    turret.update();
    turret.rotation = 0.9;
    for (const alpha of [0, 1 / 6, 0.5, 5 / 6, 1]) {
      f.game.gameStateMachine.accumulator = alpha * 33;
      const rootAngle = (alpha * Math.PI) / 2;
      const x = 1000 + 32 * alpha + 40 * Math.cos(rootAngle) + 20 * Math.sin(rootAngle);
      const y = 2000 + 64 * alpha + 40 * Math.sin(rootAngle) - 20 * Math.cos(rootAngle);
      // Redrawing the same alpha must never accumulate the bar translation.
      for (let redraw = 0; redraw < 2; redraw++) {
        for (const part of [component, spawner, turret]) {
          part.draw();
          close(part._mc.x, x);
          close(part._mc.y, y);
          close(part.hpBar.x, x);
          close(part.hpBar.y, y - 10);
          close(part.shieldBar.y, y - 15);
        }
        const spin = rootAngle + 6 + 0.5 * alpha + 0.3;
        close(component._mc.rotation, spin);
        close(component.effectTarget.x, x + 12 * Math.cos(spin) + 8 * Math.sin(spin));
        close(component.effectTarget.y, y + 12 * Math.sin(spin) - 8 * Math.cos(spin));
        close(component.effectTarget.rotation, spin);
        close(spawner._mc.rotation, rootAngle + 0.4);
        close(turret._mc.rotation, 0.7 + 0.2 * alpha);
      }
    }
    component.reset();
    component.currentAngleOffset = 0;
    component.draw();
    close(component._mc.rotation, Math.PI / 2 + 0.3);
    turret.reset();
    turret.rotation = 2;
    turret.draw();
    close(turret._mc.rotation, 2);
  } finally {
    f.dispose();
  }
});
