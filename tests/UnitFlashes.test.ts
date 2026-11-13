import assert from 'node:assert/strict';
import test from 'node:test';
import type { API, Raw } from '../src/api/Types';
import { installUnitFlashes } from '../src/rendering/UnitFlashes';
// @ts-expect-error Real host hook implementation.
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const pending: { delay: number; run: () => void }[] = [];
  const cleanup: (() => void)[] = [];
  const images: Image[] = [];
  class Image {
    style: Raw;
    blendMode = 'normal';
    alpha = 1;
    visible = true;
    disposed = false;
    transformationMatrix = { tx: 0, ty: 0 };
    adjustments = 0;
    constructor(texture: object) {
      this.style = { texture };
      images.push(this);
    }
    get_texture() {
      return this.style.texture;
    }
    setStyle(style: Raw, copy = true) {
      if (copy) Object.assign(style, this.style);
      this.style = style;
    }
    set_blendMode(mode: string) {
      this.blendMode = mode;
    }
    set_texture(texture: object) {
      this.style.texture = texture;
    }
    readjustSize() {
      this.adjustments++;
    }
    set_touchable() {}
    set_transformationMatrix(matrix: { tx: number; ty: number }) {
      this.transformationMatrix = { ...matrix };
    }
    set_alpha(alpha: number) {
      this.alpha = alpha;
    }
    set_visible(visible: boolean) {
      this.visible = visible;
    }
    removeFromParent() {}
    dispose() {
      this.disposed = true;
    }
  }
  class Unit {
    isFlashing = false;
    g: Game;
    constructor(game: Game) {
      this.g = game;
    }
    destroy() {}
    reset() {}
    damageFlash() {
      throw new Error('Legacy filter should be replaced');
    }
  }
  class Enemy extends Unit {
    kamikazeStarted = false;
    kamikazeTtl = 1;
    kamikazeWhenClose = false;
    explosions = 0;
    sign = 1;
    _mc = new Image({ name: 'ship texture' });
    startKamikaze() {
      throw new Error('Legacy filter should be replaced');
    }
    override destroy() {
      if (this.kamikazeStarted) this.explosions++;
      super.destroy();
    }
  }
  class Game {
    draw() {}
    exit() {}
  }
  class Base {}
  const classes: Raw = {
    'core.unit.Unit': Unit,
    'core.ship.EnemyShip': Enemy,
    'core.scene.Game': Game,
    'starling.display.Image': Image,
    'starling.rendering.MeshEffect': Base,
    'starling.styles.MeshStyle': Base,
    'com.greensock.TweenMax': {
      delayedCall(delay: number, run: () => void) {
        pending.push({ delay, run });
      },
    },
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api: Raw = {
    cls: (name: string) => classes[name],
    defer: (fn: () => void) => cleanup.push(fn),
  };
  for (const kind of ['around', 'before', 'after']) {
    api[kind] = (target: Raw, key: string, callback: Function) => {
      const remove = hooks.add(target, key, kind, callback);
      cleanup.push(remove);
      return remove;
    };
  }
  installUnitFlashes(api as API);
  const game = new Game();
  return {
    enemy: new Enemy(game),
    game,
    images,
    pending,
    dispose: () => cleanup.reverse().forEach((fn) => fn()),
  };
}

test('destroy retains the vanilla explosion but ends the original client flash lifecycle', () => {
  const { enemy, pending, dispose } = fixture();
  const originalStyle = enemy._mc.style;
  enemy.startKamikaze();
  assert.equal(pending[0].delay, 0.125);
  pending.shift()!.run();
  assert.notEqual(enemy._mc.style, originalStyle);
  assert.equal(enemy._mc.blendMode, 'add');
  enemy.destroy();
  assert.equal(enemy.explosions, 1);
  assert.equal(enemy.kamikazeStarted, false);
  assert.equal(enemy._mc.style, originalStyle);
  assert.equal(enemy._mc.blendMode, 'normal');
  pending.shift()!.run();
  assert.equal(pending.length, 0);
  dispose();
});

test('reset and plugin disposal invalidate pending pulses, including a reused enemy', () => {
  const { enemy, pending, dispose } = fixture();
  enemy.startKamikaze();
  const oldPulse = pending.shift()!;
  enemy.reset();
  assert.equal(enemy.kamikazeStarted, false);
  enemy.startKamikaze();
  oldPulse.run();
  assert.equal(enemy._mc.blendMode, 'normal');
  pending.shift()!.run();
  assert.equal(enemy._mc.blendMode, 'add');
  dispose();
  assert.equal(enemy.kamikazeStarted, false);
  assert.equal(enemy._mc.blendMode, 'normal');
  pending.shift()!.run();
  assert.equal(pending.length, 0);
});

test('flash style replacement preserves the source texture needed by the GPU shader', () => {
  const { enemy, pending, dispose } = fixture();
  const texture = enemy._mc.get_texture();
  enemy.startKamikaze();
  pending.shift()!.run();
  assert.equal(enemy._mc.get_texture(), texture);
  pending.shift()!.run();
  assert.equal(enemy._mc.get_texture(), texture);
  dispose();
});

test('ending a kamikaze pulse keeps the current animation frame instead of rewinding it', () => {
  const { enemy, pending, dispose } = fixture();
  const originalStyle = enemy._mc.style;
  enemy.startKamikaze();
  pending.shift()!.run();
  const nextFrame = { name: 'next animation frame' };
  enemy._mc.style.texture = nextFrame;
  pending.shift()!.run();
  assert.equal(enemy._mc.style, originalStyle);
  assert.equal(enemy._mc.get_texture(), nextFrame);
  dispose();
});

test('damage overlay follows rendered animation and alpha for 80ms and ignores stale pooled callbacks', () => {
  const { enemy, game, images, pending, dispose } = fixture();
  enemy._mc.alpha = 0.4;
  enemy._mc.transformationMatrix = { tx: 12, ty: 25 };
  enemy.damageFlash();
  const overlay = images[1];
  assert.equal(overlay.get_texture(), enemy._mc.get_texture());
  assert.equal(overlay.blendMode, 'add');
  assert.equal(overlay.alpha, 0.4);
  assert.deepEqual(overlay.transformationMatrix, { tx: 12, ty: 25 });
  assert.equal(pending[0].delay, 0.08);
  enemy.damageFlash();
  assert.equal(pending.length, 1, 'repeated hits do not extend the active flash');
  const frame = { name: 'animated hit frame' };
  enemy._mc.set_texture(frame);
  enemy._mc.alpha = 0.7;
  enemy._mc.transformationMatrix = { tx: 50, ty: 80 };
  game.draw();
  assert.equal(overlay.get_texture(), frame);
  assert.equal(overlay.adjustments, 1);
  assert.equal(overlay.alpha, 0.7);
  assert.deepEqual(overlay.transformationMatrix, { tx: 50, ty: 80 });
  const stale = pending.shift()!;
  enemy.reset();
  assert.equal(overlay.disposed, true);
  enemy.damageFlash();
  stale.run();
  assert.equal(enemy.isFlashing, true);
  assert.equal(images[2].visible, true);
  pending.shift()!.run();
  assert.equal(enemy.isFlashing, false);
  assert.equal(images[2].visible, false);
  dispose();
});
