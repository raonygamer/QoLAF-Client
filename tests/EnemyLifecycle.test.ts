import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installEnemyLifecycle } from '../src/ship/EnemyLifecycle';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('enemy reset retires owned effects and labels without killing emitters reused by another ship', () => {
  class Emitter {
    alive = true;
    kills = 0;
    constructor(public target: object) {}
    killEmitter() {
      this.kills++;
      this.alive = false;
    }
  }
  class Label {
    attached = true;
    disposals = 0;
    removeFromParent(dispose = false) {
      this.attached = false;
      if (dispose) this.disposals++;
    }
  }
  class Enemy {
    isAddedToCanvas = false;
    additions = 0;
    resets = 0;
    rareEmitters: Emitter[] | null = [];
    aiHardenedShieldEffect: Emitter[] | null = [];
    AFName: Label | null = new Label();
    addToCanvasForReal() {
      this.additions++;
      this.isAddedToCanvas = true;
    }
    removeFromCanvas() {
      this.isAddedToCanvas = false;
    }
    reset() {
      this.resets++;
      this.AFName = null;
    }
    // Native build564 checks ownership because emitter instances are pooled.
    killOwnEmitters(emitters: Emitter[] | null) {
      if (emitters) {
        for (const emitter of emitters)
          if (emitter.alive && emitter.target === this) emitter.killEmitter();
        emitters.length = 0;
      }
    }
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
  const api = {
    cls: (name: string) => (name === 'core.ship.EnemyShip' ? Enemy : {}),
    before: hook('before'),
    around: hook('around'),
  } as unknown as API;
  bindGameClasses(api);
  installEnemyLifecycle(api);
  try {
    const enemy = new Enemy();
    const label = enemy.AFName!;
    enemy.addToCanvasForReal();
    enemy.addToCanvasForReal();
    assert.equal(enemy.additions, 1);
    enemy.removeFromCanvas();
    assert.equal(label.attached, false, 'detach labels even without AF faction');
    assert.equal(label.disposals, 0, 'culling keeps the reusable label');
    enemy.addToCanvasForReal();
    assert.equal(enemy.additions, 2);
    const rare = new Emitter(enemy);
    const shield = new Emitter(enemy);
    const reused = new Emitter(new Enemy());
    const expired = new Emitter(enemy);
    expired.alive = false;
    enemy.rareEmitters = [rare, reused, expired];
    enemy.aiHardenedShieldEffect = [shield];
    enemy.reset();
    assert.deepEqual([rare.kills, shield.kills, reused.kills, expired.kills], [1, 1, 0, 0]);
    assert.deepEqual(enemy.rareEmitters, []);
    assert.deepEqual(enemy.aiHardenedShieldEffect, []);
    assert.equal(label.disposals, 1);
    assert.equal(enemy.AFName, null);
    enemy.rareEmitters = enemy.aiHardenedShieldEffect = null;
    enemy.reset();
    assert.equal(enemy.resets, 2);
    assert.equal(label.disposals, 1);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  const restored = new Enemy();
  restored.addToCanvasForReal();
  restored.addToCanvasForReal();
  assert.equal(restored.additions, 2, 'unload restores native methods');
});
