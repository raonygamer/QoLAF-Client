import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawProjectileFrame, installProjectileFrames } from '../src/rendering/ProjectileFrames';
import { installRenderPosition } from '../src/rendering/RenderPosition';
import { emitterTargetPose } from '../src/rendering/EmitterFrames';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

class Clip extends Display {
  rotation = 0;
  set_rotation(value: number) {
    this.rotation = value;
  }
  get_rotation() {
    return this.rotation;
  }
}

function apiFor(classes: Record<string, any>) {
  const hooks = new Hooks();
  const cleanup: Function[] = [];
  const api = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
    before: (target: any, name: string, fn: Function) =>
      cleanup.push(hooks.add(target, name, 'before', fn)),
    after: (target: any, name: string, fn: Function) =>
      cleanup.push(hooks.add(target, name, 'after', fn)),
    around: (target: any, name: string, fn: Function) =>
      cleanup.push(hooks.add(target, name, 'around', fn)),
  };
  return { api: api as any, dispose: () => cleanup.reverse().forEach((fn) => fn()) };
}

test('projectile vertices advance on display frames with no simulation tick', () => {
  class Projectile {
    alive = true;
    isAddedToCanvas = true;
    isVisible = true;
    imgObj = {};
    course = { pos: { x: 100, y: 200 }, speed: { x: 300, y: -100 } };
    _rotation = 0;
    _mc = new Clip();
    constructor(public g: any) {}
    update() {
      this._rotation += 0.1;
    }
    reset() {
      this._rotation = 0;
    }
    get_rotation() {
      return this._rotation;
    }
    get_hasImage() {
      return true;
    }
    get_movieClip() {
      return this._mc;
    }
    draw() {
      this._mc.set_x(this.course.pos.x);
      this._mc.set_y(this.course.pos.y);
    }
  }
  class Game {
    gameStateMachine = { accumulator: 0 };
    projectileManager: any;
    draw() {
      for (const p of this.projectileManager.projectiles) if (p.isAddedToCanvas) p.draw();
    }
  }
  const fixture = apiFor({ 'core.projectile.Projectile': Projectile, 'core.scene.Game': Game });
  installProjectileFrames(fixture.api);
  const game = new Game();
  const projectile = new Projectile(game);
  const vertices: number[][] = [];
  game.projectileManager = {
    projectiles: [projectile],
    meshBatch: {
      clear() {
        vertices.length = 0;
      },
      addMesh(clip: Display) {
        vertices.push([clip.get_x(), clip.get_y()]);
      },
    },
  };
  for (const fps of [60, 120, 180]) {
    const xs: number[] = [];
    for (let time = 0; time < 33; time += 1000 / fps) {
      game.gameStateMachine.accumulator = time;
      game.draw();
      assert.equal(vertices.length, 1);
      assert.equal(vertices[0][0], 100 + 0.3 * time);
      xs.push(vertices[0][0]);
    }
    assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]));
  }
  assert.deepEqual(projectile.course.pos, { x: 100, y: 200 }, 'rendering must not advance physics');
  projectile.alive = false;
  game.draw();
  assert.equal(vertices.length, 0, 'dead meshes must not survive the next display frame');
  fixture.dispose();
});

test('projectile frame prediction uses source rotation delta and clamps interpolation', () => {
  const clip = new Clip();
  const p = {
    alive: true,
    _mc: clip,
    course: { pos: { x: 4, y: 8 }, speed: { x: 100, y: 200 } },
    rotation: 1,
    g: { gameStateMachine: { accumulator: 100 } },
  };
  drawProjectileFrame(p, 0.2);
  assert.ok(Math.abs(clip.get_x() - 7.3) < 1e-10);
  assert.equal(clip.get_rotation(), 1.2);
});

test('undrawn body anchors use world coordinates, never a stale clip at the origin', () => {
  class GameObject {
    pos = { x: 1234, y: -567 };
    rotation = 0.5;
    _mc = new Clip();
    imgObj: any = null;
    isAddedToCanvas = false;
    draw() {
      if (this.imgObj) {
        this._mc.set_x(this.pos.x);
        this._mc.set_y(this.pos.y);
      }
    }
    addToCanvas() {
      this.isAddedToCanvas = true;
    }
    reset() {
      this._mc.set_x(0);
      this._mc.set_y(0);
    }
  }
  const fixture = apiFor({ 'core.GameObject': GameObject });
  installRenderPosition(fixture.api);
  const body = new GameObject();
  body.addToCanvas();
  body.draw();
  assert.deepEqual(emitterTargetPose(body), { x: 1234, y: -567, rotation: 0.5 });
  body.imgObj = {};
  body.draw();
  body._mc.set_x(1300);
  assert.equal(emitterTargetPose(body).x, 1300);
  body.reset();
  assert.equal(emitterTargetPose(body).x, 1234);
  body.draw();
  body.addToCanvas();
  body._mc.set_x(0);
  assert.equal(emitterTargetPose(body).x, 1234);
  fixture.dispose();
});
