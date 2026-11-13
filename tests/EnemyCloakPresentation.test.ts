import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installEnemyCloakPresentation } from '../src/ship/EnemyCloakPresentation';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('cloak reapplies the source fade before draw and resets pooled hull and overhead opacity', () => {
  class Display {
    alpha = 1;
    visible = true;
    set_alpha(value: number) {
      this.alpha = value;
    }
    get_alpha() {
      return this.alpha;
    }
    get_visible() {
      return this.visible;
    }
  }
  class Enemy {
    _mc: Display | null = new Display();
    AFName = new Display();
    hpBar = new Display();
    shieldBar = new Display();
    alive = true;
    isAddedToCanvas = true;
    aiCloak = false;
    course = { x: 100, y: 200 };
    drawnAlpha = 1;
    cloakStart() {
      throw Error('native off-map cloak must not execute');
    }
    cloakEnd() {
      throw Error('native course replacement must not execute');
    }
    set_alpha(value: number) {
      this._mc?.set_alpha(value);
      return value;
    }
    get_alpha() {
      return this._mc?.get_alpha() ?? 1;
    }
    reset() {}
    draw() {
      this.drawnAlpha = this._mc?.get_alpha() ?? 1;
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
    after: hook('after'),
    around: hook('around'),
    defer: (cleanup: () => void) => cleanups.push(cleanup),
  } as unknown as API;
  bindGameClasses(api);
  installEnemyCloakPresentation(api);
  try {
    const enemy = new Enemy();
    const course = enemy.course;
    enemy.set_alpha(0.8);
    enemy.cloakStart();
    enemy.cloakStart();
    enemy.draw();
    assert.equal(enemy.drawnAlpha, 0.4, 'repeated cloak does not halve twice');
    assert.equal(enemy.hpBar.alpha, 0.4);
    enemy.set_alpha(0.6);
    enemy._mc = new Display();
    enemy.draw();
    assert.equal(enemy.drawnAlpha, 0.3, 'replacement clip inherits ongoing fade and cloak');
    assert.equal(enemy.AFName.alpha, 0.3);
    enemy.cloakEnd();
    enemy.draw();
    assert.equal(enemy.drawnAlpha, 0.6, 'uncloaking preserves base fade');
    assert.equal(enemy.course, course);
    assert.equal(enemy.aiCloak, false);
    enemy._mc.visible = false;
    enemy.draw();
    assert.deepEqual([enemy.AFName.alpha, enemy.hpBar.alpha, enemy.shieldBar.alpha], [0, 0, 0]);
    enemy._mc.visible = true;
    enemy.cloakStart();
    enemy.reset();
    enemy.draw();
    assert.equal(enemy.drawnAlpha, 1, 'pooled reuse must not retain previous opacity');
    enemy._mc = null;
    enemy.set_alpha(NaN);
    assert.equal(enemy.get_alpha(), 0);
    enemy.draw();
    assert.equal(enemy.hpBar.alpha, 0);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  const native = new Enemy();
  native.set_alpha(0.7);
  native.draw();
  assert.equal(native.drawnAlpha, 0.7);
});
