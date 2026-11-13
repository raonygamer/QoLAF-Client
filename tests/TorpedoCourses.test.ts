import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import {
  installTorpedoCourses,
  observeTorpedoContacts,
  torpedoContact,
  type TorpedoContactSnapshot,
} from '../src/projectile/TorpedoCourses';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

interface CoursePacket {
  length: number;
  getInt(index: number): number;
  getNumber(index: number): number;
}

function fixture(correctionEnabled = true) {
  class Target {
    alive = true;
    invulnerable = false;
    collisionRadius = 1;
    hp = 100;
    eligible = true;
    course = { time: 0, pos: { x: 16.5, y: 0 }, speed: { x: 0, y: 0 } };
    transition = Infinity;
    get_pos() {
      return this.course.pos;
    }
    get_course() {
      return this.course;
    }
    isBoostActiveAt(time: number) {
      return time >= this.transition;
    }
    canBeDamage() {
      return this.eligible;
    }
  }
  const game = {
    time: 0,
    shipManager: { players: [] as Target[] },
    unitManager: { units: [] as Target[] },
  };
  class Shot {
    g = game;
    direction = 0;
    unit: object = {};
    course = { time: 0, pos: { x: 0, y: 0 }, speed: { x: 1000, y: 0 }, rotation: 0 };
    oldPos = { x: 0, y: 0 };
    collisionRadius = 2;
    ttl = 1000;
    x = 0;
    y = 0;
    destroyed = 0;
    reported: object | undefined;
    reset() {}
    fastforward() {}
    set_id(_id: number) {}
    set_rotation(_angle: number) {}
    set_x(x: number) {
      this.x = x;
    }
    set_y(y: number) {
      this.y = y;
    }
    updateHeading(heading: typeof this.course) {
      heading.pos.x += heading.speed.x * 0.033;
      heading.pos.y += heading.speed.y * 0.033;
      heading.time += 33;
    }
    destroy() {
      this.destroyed++;
      this.reported = torpedoContact(this);
    }
  }
  class Manager {
    createSetProjectile(_shot: Shot, _id: number, _unit: object, _heading: Shot['course']) {}
    activateProjectile(_shot: Shot) {}
    g = game;
    projectilesById = { h: {} as Record<string, Shot> };
    nativeUpdates = 0;
    updateCourse(message: CoursePacket) {
      this.nativeUpdates++;
      for (let index = 0; index < message.length; index += 14) {
        const shot = this.projectilesById.h[String(message.getInt(index))];
        if (!shot) return;
        shot.direction = message.getNumber(index + 2);
      }
    }
  }
  class Bullet {
    p = new Shot();
    m = game;
    isEnemy = false;
    nativeCalls = 0;
    execute() {
      this.nativeCalls++;
    }
  }
  const classes: Record<string, unknown> = {
    'core.projectile.Projectile': Shot,
    'core.projectile.ProjectileManager': Manager,
    'core.states.aistates.ProjectileBullet': Bullet,
    'core.ship.Ship': Target,
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    ...Object.fromEntries(
      ['around', 'before'].map((kind) => [
        kind,
        (owner: object, key: string, callback: unknown) => {
          const off = hooks.add(owner, key, kind, callback);
          cleanups.push(off);
          return off;
        },
      ]),
    ),
  } as unknown as API;
  bindGameClasses(api);
  installTorpedoCourses(
    api,
    () => correctionEnabled,
    () => {},
  );
  const state = new Bullet();
  new Manager().createSetProjectile(state.p, 1, state.p.unit, state.p.course);
  return {
    game,
    state,
    Target,
    Manager,
    dispose: () => cleanups.reverse().forEach((off) => off()),
  };
}

test('server bullet sweeps moving targets, chooses earliest contact and preserves resources', () => {
  const { game, state, Target, dispose } = fixture();
  const near = new Target();
  near.course.pos.y = 16.5;
  near.course.speed.y = -1000;
  const far = new Target();
  far.course.pos.x = 30;
  game.unitManager.units.push(far, near);
  const observed: Array<{ target: object; x: number; snapshot: TorpedoContactSnapshot }> = [];
  const off = observeTorpedoContacts((_shot, target, snapshot) => {
    observed.push({ target, x: state.p.x, snapshot });
  });
  try {
    game.time = 33;
    state.execute();
    assert.equal(observed.length, 1);
    assert.equal(observed[0].target, near);
    assert.equal(observed[0].x, 0, 'observer runs before applying impact');
    assert.ok(observed[0].snapshot.fraction > 0 && observed[0].snapshot.fraction < 0.5);
    assert.equal(observed[0].snapshot.shotStartX, 0);
    assert.equal(observed[0].snapshot.shotEndX, 33);
    assert.equal(state.p.reported, near);
    assert.equal(state.p.destroyed, 1);
    assert.equal(torpedoContact(state.p), undefined, 'contact scope ends after destroy');
    assert.equal(state.p.y, 0);
    assert.equal(near.hp, 100);
    assert.equal(far.hp, 100);
    assert.equal(state.nativeCalls, 0);
  } finally {
    off();
    dispose();
  }
});

test('server bullet rejects discontinuities, boost transitions and ineligible targets', () => {
  for (const reason of ['gap', 'rollback', 'boost', 'ineligible', 'invulnerable'] as const) {
    const { game, state, Target, dispose } = fixture();
    try {
      const target = new Target();
      game.unitManager.units.push(target);
      game.time = reason === 'gap' ? 101 : reason === 'rollback' ? -1 : 33;
      if (reason === 'boost') target.transition = 10;
      if (reason === 'ineligible') target.eligible = false;
      if (reason === 'invulnerable') target.invulnerable = true;
      state.execute();
      assert.equal(state.p.destroyed, 0, reason);
      assert.equal(target.hp, 100, reason);
    } finally {
      dispose();
    }
  }
});

test('missing projectile records do not discard subsequent updates when prediction is disabled', () => {
  const { state, Manager, dispose } = fixture(false);
  const manager = new Manager();
  manager.projectilesById.h['7'] = state.p;
  const packet = (ids: number[], direction: number | number[]): CoursePacket => {
    const values = ids.flatMap((id, index) => [
      id,
      0,
      Array.isArray(direction) ? direction[index] : direction,
      4,
      ...Array<number>(10).fill(0),
    ]);
    return { length: values.length, getInt: (i) => values[i], getNumber: (i) => values[i] };
  };
  try {
    manager.updateCourse(packet([999, 7], 1));
    assert.equal(state.p.direction, 1, 'known shot after missing first record still updates');
    assert.equal(manager.nativeUpdates, 0, 'native early-return path is bypassed');
    manager.updateCourse(packet([7, 999, 7], [0, 0, 2]));
    assert.equal(state.p.direction, 2);
    manager.updateCourse(packet([7], 0));
    assert.equal(manager.nativeUpdates, 1, 'fully known ordinary packet keeps native path');
    assert.equal(state.p.direction, 0);
  } finally {
    dispose();
  }
  manager.updateCourse(packet([999, 7], 1));
  assert.equal(state.p.direction, 0, 'unload restores native behavior');
});
