import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBossEffects } from '../src/rendering/BossEffects';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('boss effects wait for positioned activation, start once, and cancel on reset or destruction', () => {
  const game = {};
  class Effect {
    posX = 0;
    posY = 0;
    starts: number[][] = [];
    play() {
      this.starts.push([this.posX, this.posY]);
    }
  }
  const emitters = {
    create(_key: string, _game: object, _x: number, _y: number, _target: object, play: boolean) {
      const effect = new Effect();
      if (play) effect.play();
      return [effect];
    },
  };
  class Component {
    active = false;
    alive = true;
    effectTarget = {
      x: 0,
      y: 0,
      get_x() {
        return this.x;
      },
      get_y() {
        return this.y;
      },
    };
    effect: Effect[] = [];
    update() {
      if (!this.active || !this.alive) return;
      this.effectTarget.x = 140;
      this.effectTarget.y = -75;
    }
    reset() {}
    destroy() {
      this.alive = false;
    }
  }
  const factory = {
    createBossComponent(_definition: object, component: Component, scene: object) {
      component.effect = emitters.create('bossEffect', scene, 0, 0, component.effectTarget, true);
    },
  };
  const classes: Record<string, unknown> = {
    'core.boss.BossComponent': Component,
    'core.boss.BossFactory': factory,
    'core.particle.EmitterFactory': emitters,
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    defer: (off: () => void) => cleanup.push(off),
    ...Object.fromEntries(
      ['around', 'before', 'after'].map((kind) => [
        kind,
        (owner: object, key: string, callback: unknown) => {
          const off = hooks.add(owner, key, kind, callback);
          cleanup.push(off);
          return off;
        },
      ]),
    ),
  } as unknown as API;
  bindGameClasses(api);
  installBossEffects(api);
  const originalCreate = emitters.create;
  try {
    const component = new Component();
    factory.createBossComponent({}, component, game);
    assert.equal(emitters.create, originalCreate);
    component.update();
    assert.deepEqual(component.effect[0].starts, []);
    component.active = true;
    component.update();
    component.update();
    assert.deepEqual(component.effect[0].starts, [[140, -75]]);
    for (const action of ['reset', 'destroy'] as const) {
      const canceled = new Component();
      factory.createBossComponent({}, canceled, game);
      canceled[action]();
      canceled.active = true;
      canceled.update();
      assert.deepEqual(canceled.effect[0].starts, [], action);
    }
    assert.equal(emitters.create('other', game, 0, 0, {}, true)[0].starts.length, 1);
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  const native = new Component();
  factory.createBossComponent({}, native, game);
  assert.deepEqual(native.effect[0].starts, [[0, 0]], 'hot disable restores native factory');
});
