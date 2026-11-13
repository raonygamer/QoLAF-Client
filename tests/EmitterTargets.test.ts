import type { Emitter as NativeEmitter } from '../src/game/Bindings';
import type { Engine as NativeEngine, EnemyShip } from '../src/game/Bindings';
import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EmitterTargets } from '../src/rendering/EmitterTargets';
import { EmitterFrames, installEmitterFrames } from '../src/rendering/EmitterFrames';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';
import type { Raw } from '../src/api/Types';

class Engine {
  ship: Raw | null = null;
}
class Enemy {
  id = 7;
  get_id() {
    return this.id;
  }
}
function fixture(target: Raw) {
  const targets = new EmitterTargets(
    Engine as unknown as typeof NativeEngine,
    Enemy as unknown as typeof EnemyShip,
  );
  const emitter: Raw = {
    followTarget: true,
    target,
    g: { shipManager: { enemiesById: { h: { 7: target } } } },
  };
  targets.capture(emitter);
  return { targets, emitter };
}

test('effects capture pooled target generation before their first rendered frame', () => {
  const target = {};
  const { targets, emitter } = fixture(target);
  assert.equal(targets.stale(emitter), false);
  targets.resetTarget(target);
  assert.equal(targets.stale(emitter), true);
  targets.capture(emitter); // A new factory-created effect for the new life.
  assert.equal(targets.stale(emitter), false);
  targets.resetTarget(target);
  targets.release(emitter); // Reusing the emitter pool also releases its old attachment.
  emitter.target = {};
  assert.equal(targets.stale(emitter), false);
  targets.resetTarget(emitter.target);
  assert.equal(targets.stale(emitter), true);
  emitter.followTarget = false;
  assert.equal(
    targets.stale(emitter),
    true,
    'stopping position-following does not detach a stale pooled owner',
  );
  emitter.target = null;
  assert.equal(targets.stale(emitter), false, 'detached explosions retain independent lifetime');
});

test('engine effects reject a removed mount, missing ship and dead ship', () => {
  const engine = new Engine();
  engine.ship = { alive: true, engine };
  const { targets, emitter } = fixture(engine);
  assert.equal(targets.stale(emitter), false);
  engine.ship.engine = new Engine();
  assert.equal(targets.stale(emitter), true);
  emitter.followTarget = false;
  assert.equal(targets.stale(emitter), true, 'non-following effects still reject removed mounts');
  engine.ship.engine = engine;
  engine.ship.alive = false;
  assert.equal(targets.stale(emitter), true);
  engine.ship = null;
  assert.equal(targets.stale(emitter), true);
});

test('enemy effects use native ID getters and actual registry identity', () => {
  const enemy = new Enemy();
  const { targets, emitter } = fixture(enemy);
  assert.equal(targets.stale(emitter), false);
  emitter.g.shipManager.enemiesById.h[7] = new Enemy();
  assert.equal(targets.stale(emitter), true);
  emitter.g.shipManager.enemiesById.h[7] = enemy;
  enemy.id = 0;
  assert.equal(targets.stale(emitter), true);
});

test('stale emitter is killed before particle emission, positioning or batch writes', () => {
  const { targets, emitter } = fixture({});
  targets.resetTarget(emitter.target);
  let kills = 0;
  emitter.alive = true;
  emitter.killEmitter = () => {
    kills++;
    emitter.alive = false;
  };
  // Deliberately no particle pools: any continued update would fail.
  const frames = new EmitterFrames(
    class {
      constructor() {
        throw Error('Stale emitter allocated a particle');
      }
    } as new () => import('../src/game/Bindings').Particle,
    { POOL_SIZE_MAX: 0, POOL_SIZE_MIN: 0, IS_HIGH_GRAPHICS: false, setHighGraphics() {} },
    {
      interpolateColor() {
        throw Error('Stale emitter interpolated color');
      },
    },
    targets,
  );
  frames.update(emitter as NativeEmitter, 5.5);
  assert.equal(kills, 1);
  assert.equal(emitter.alive, false);
});

test('factory capture and native reset hooks invalidate effects before their first frame and clean up', () => {
  class GameObject {
    get_movieClip() {
      return null;
    }
    get_x() {
      return 0;
    }
    get_y() {
      return 0;
    }
    reset() {}
  }
  class EngineObject extends GameObject {
    reset() {}
  }
  class Emitter {
    static setHighGraphics() {}
    dispose() {}
    updateOnScreen() {}
    update() {}
    play() {}
    killEmitter() {}
    removeFromCollectiveMeshBatch() {}
  }
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const manager: Raw = {
    emitters: [],
    update() {},
    removeEmitter(emitter: Raw, index: number) {
      emitter.killEmitter();
      this.emitters.splice(index, 1);
      emitter.dispose();
    },
  };
  class GameScene {}
  const game = Object.assign(new GameScene(), {
    get_isLeaving: () => false,
    emitterManager: manager,
    parallaxManager: { update(_seconds: number) {} },
  });
  const factory = {
    resolveTexture() {
      return null;
    },
    create(_key: string, _game: Raw, _x: number, _y: number, target: Raw) {
      const emitter = Object.assign(new Emitter(), {
        target,
        followTarget: true,
        alive: true,
        kills: 0,
        killEmitter() {
          this.kills++;
          this.alive = false;
        },
      });
      manager.emitters.push(emitter);
      return [emitter];
    },
  };
  const classes: Raw = {
    'core.scene.Game': GameScene,
    'core.GameObject': GameObject,
    'core.engine.Engine': EngineObject,
    'core.particle.Emitter': Emitter,
    'core.particle.Particle': class {},
    'generics.Color': {},
    'core.particle.CollectiveMeshBatch': { AllMeshesAreUpdated() {}, disposeAll() {} },
    'core.particle.EmitterFactory': factory,
    'core.weapon.Beam': class {
      initEffects() {}
      destroy() {}
    },
  };
  const api: any = {
    cls: (name: string) => classes[name],
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    after: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    onGame: (callback: Function) => callback(game, api),
  };
  const originalCreate = factory.create;
  const originalReset = GameObject.prototype.reset;
  class BindingFixture {
    removeEmitter() {}
    loadKey() {
      return null;
    }
    getEmitter() {
      return null;
    }
    static getService() {
      return { loadKey: () => ({ emitters: [] }) };
    }
    enter() {}
    execute() {}
    reset() {}
    clean() {}
    dispose() {}
    update() {}
  }
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? BindingFixture });
  installEmitterFrames(api);
  try {
    for (const target of [
      new GameObject(),
      Object.assign(new EngineObject(), { ship: {} as Raw }),
    ]) {
      if ('ship' in target) Object.assign(target.ship as Raw, { engine: target, alive: true });
      const [emitter] = factory.create('effect', game, 0, 0, target);
      target.reset();
      game.parallaxManager.update(0.0055);
      assert.equal(emitter.kills, 1);
      assert.equal(emitter.alive, false);
      game.parallaxManager.update(0.0055);
      assert.equal(manager.emitters.length, 0);
    }
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  assert.equal(factory.create, originalCreate);
  assert.equal(GameObject.prototype.reset, originalReset);
});
