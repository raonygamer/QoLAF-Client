import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBossCulling } from '../src/rendering/BossCulling';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('boss culling follows camera bounds, zoom, radius and resize without changing radar distance', () => {
  const camera = {
    _worldCullingRadius: undefined as number | undefined,
    revision: 0,
    isZooming: false,
    x: 10000,
    y: 20000,
    get_viewCenterX() {
      return this.x;
    },
    get_viewCenterY() {
      return this.y;
    },
    get_viewSizeRevision() {
      return this.revision;
    },
    get_worldCullingRadius() {
      return this._worldCullingRadius ?? 0;
    },
  };
  class Boss {
    g = { camera };
    position = { x: 11100, y: 20000 };
    bossRadius = 200;
    distanceToCamera = 23000;
    distanceToCameraX = 11000;
    distanceToCameraY = 20000;
    nextDistanceCalculation = 5000;
    isAddedToCanvas = false;
    alive = true;
    awaitingActivation = false;
    nativeCalls = 0;
    additions = 0;
    removals = 0;
    get_pos() {
      return this.position;
    }
    addToCanvas() {
      this.isAddedToCanvas = true;
      this.additions++;
    }
    removeFromCanvas() {
      this.isAddedToCanvas = false;
      this.removals++;
    }
    updateIsNear() {
      this.nativeCalls++;
    }
    update() {
      if (!this.alive || this.awaitingActivation) return;
      if (this.nextDistanceCalculation <= 0) this.updateIsNear();
      else this.nextDistanceCalculation -= 33;
    }
    reset() {}
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
    cls: (name: string) => (name === 'core.boss.Boss' ? Boss : {}),
    before: hook('before'),
    around: hook('around'),
  } as unknown as API;
  bindGameClasses(api);
  installBossCulling(api);
  try {
    const boss = new Boss();
    boss.updateIsNear();
    assert.equal(boss.nativeCalls, 1, 'native fallback before camera initialization');
    camera._worldCullingRadius = 1000;
    boss.update();
    assert.equal(boss.isAddedToCanvas, true, 'radius overlaps view despite distant player');
    assert.deepEqual(
      [boss.distanceToCamera, boss.distanceToCameraX, boss.distanceToCameraY],
      [23000, 11000, 20000],
    );
    boss.update();
    assert.equal(boss.additions, 1, 'do not re-add attached components');

    camera.isZooming = true;
    camera._worldCullingRadius = 500;
    boss.update();
    assert.equal(boss.isAddedToCanvas, false);
    assert.equal(boss.removals, 1);
    camera.isZooming = false;
    camera._worldCullingRadius = 1500;
    camera.revision++;
    boss.update();
    assert.equal(boss.isAddedToCanvas, true, 'resize invalidates positive countdown');

    boss.position.x = 100000;
    boss.updateIsNear();
    assert.equal(boss.nextDistanceCalculation, 5000, 'source maximum recheck delay');
    boss.position.x = camera.x;
    boss.reset();
    boss.update();
    assert.equal(boss.isAddedToCanvas, true, 'pooled boss gets a fresh visibility check');
    camera.isZooming = true;
    boss.awaitingActivation = true;
    camera._worldCullingRadius = 0;
    boss.position.x = 100000;
    boss.update();
    assert.equal(boss.isAddedToCanvas, true, 'native activation guard remains intact');
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  const restored = new Boss();
  restored.updateIsNear();
  assert.equal(restored.nativeCalls, 1);
});
