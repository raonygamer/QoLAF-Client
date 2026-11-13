import {
  installProjectileThrustAnchors,
  projectileThrustPose,
  staleProjectileThrust,
} from '../src/rendering/ProjectileThrustAnchor';
import { bindGameClasses, type Projectile as GameProjectile } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawProjectileFrame, installProjectileFrames } from '../src/rendering/ProjectileFrames';
import { installRenderPosition } from '../src/rendering/RenderPosition';
import { emitterTargetPose } from '../src/rendering/EmitterFrames';
import { xhersixTorpedoWeaponKey } from '../src/projectile/XhersixTorpedoCue';
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
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
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
  class BindingFixture {
    static createProjectileAI() {
      return null;
    }
    draw() {}
    resetAllTo() {}
    getRibbonTrail() {}
    removeRibbonTrail() {}
    reclaimOrphans() {}
    enter() {}
    exit() {}
    getProjectile() {}
    fastforward() {}
    createSetProjectile() {}
    updateCourse() {}
    execute() {}
    addToCanvas() {}
    removeFromCanvas() {}
    addToCanvasForReal() {}
  }
  for (const [name, methods] of [
    ['core.projectile.Projectile', ['fastforward']],
    ['core.projectile.ProjectileManager', ['createSetProjectile', 'updateCourse']],
  ] as const) {
    const prototype = classes[name]?.prototype;
    if (prototype) for (const method of methods) prototype[method] ??= () => {};
  }
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? BindingFixture } as any);
  return { api: api as any, dispose: () => cleanup.reverse().forEach((fn) => fn()) };
}

test('installed engine getters follow rendered mounts and reject stale ownership', () => {
  class ObjectBase {
    alive = true;
    isAddedToCanvas = true;
    pos = { x: 100, y: 200 };
    rotation = 0;
    _mc = new Clip();
    get_x() {
      return this.pos.x;
    }
    get_y() {
      return this.pos.y;
    }
    get_pos() {
      return this.pos;
    }
    get_rotation() {
      return this.rotation;
    }
    get_hasImage() {
      return true;
    }
    draw() {}
    reset() {}
    addToCanvas() {}
    removeFromCanvas() {}
  }
  class Engine extends ObjectBase {
    ship: Ship | null = null;
  }
  class Ship extends ObjectBase {
    engine: Engine | null = null;
    enginePos = { x: 0, y: 10 };
  }
  const fixture = apiFor({ 'core.GameObject': ObjectBase, 'core.engine.Engine': Engine });
  installRenderPosition(fixture.api);
  try {
    const ship = new Ship();
    const engine = new Engine();
    engine.ship = ship;
    ship.engine = engine;
    ship._mc.set_x(105.5);
    ship._mc.set_y(207.25);
    ship._mc.set_rotation(Math.PI / 2);
    ship.draw();
    let pose = emitterTargetPose(engine);
    assert.ok(Math.abs(pose.x - 105.5) < 1e-10);
    assert.equal(pose.y, 197.25, 'zero-X mounts retain the original angle convention');
    assert.equal(pose.rotation, Math.PI * 1.5);
    ship._mc.set_x(106.5);
    assert.ok(Math.abs(emitterTargetPose(engine).x - 106.5) < 1e-10);
    ship.enginePos = { x: -10, y: 0 };
    pose = emitterTargetPose(engine);
    assert.equal(pose.y, 197.25, 'negative-X mounts use atan rather than atan2');
    assert.deepEqual(engine.pos, { x: 100, y: 200 });
    assert.deepEqual(ship.pos, { x: 100, y: 200 });
    ship.engine = null;
    assert.deepEqual(emitterTargetPose(engine), { x: 100, y: 200, rotation: 0 });
    ship.engine = engine;
    engine.alive = false;
    assert.deepEqual(emitterTargetPose(engine), { x: 100, y: 200, rotation: 0 });
    engine.alive = true;
    ship.reset();
    pose = emitterTargetPose(engine);
    assert.equal(pose.x, 90, 'pooled ship ignores the previous rendered clip');
    assert.equal(pose.y, 200);
  } finally {
    fixture.dispose();
  }
  assert.equal(Object.hasOwn(Engine.prototype, 'get_renderX'), false);
});

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
    get_rotation() {
      return this.rotation;
    },
    g: { gameStateMachine: { accumulator: 100 } },
  };
  drawProjectileFrame(p as unknown as GameProjectile, 0.2);
  assert.ok(Math.abs(clip.get_x() - 7.3) < 1e-10);
  assert.equal(clip.get_rotation(), 1.2);
});

test('bitmapless projectile effects follow the rendered course between ticks', () => {
  class GameObject {
    imgObj = null;
    _mc = new Clip();
    position = { x: 100, y: 200 };
    isAddedToCanvas = false;
    get_x() {
      return this.position.x;
    }
    get_y() {
      return this.position.y;
    }
    get_pos() {
      return this.position;
    }
    get_rotation() {
      return 0;
    }
    get_hasImage() {
      return this.imgObj !== null;
    }
    get_movieClip() {
      return this._mc;
    }
    // The native base draw does nothing without an image. Projectile inherits it.
    draw() {}
    reset() {
      this._mc.set_x(0);
    }
    addToCanvas() {
      this.isAddedToCanvas = true;
    }
    removeFromCanvas() {
      this.isAddedToCanvas = false;
    }
  }
  class Projectile extends GameObject {
    alive = true;
    course = { time: 0, pos: this.position, speed: { x: 400, y: -100 } };
    g = { gameStateMachine: { accumulator: 0 } };
    update() {}
  }
  class Game {
    draw() {}
  }
  const fixture = apiFor({
    'core.GameObject': GameObject,
    'core.projectile.Projectile': Projectile,
    'core.scene.Game': Game,
  });
  installRenderPosition(fixture.api);
  installProjectileFrames(fixture.api);
  const projectile = new Projectile();
  projectile.addToCanvas();
  assert.equal(emitterTargetPose(projectile).x, 100, 'undrawn pooled clip is ignored');
  for (const fps of [60, 120, 180]) {
    for (let time = 0; time < 33; time += 1000 / fps) {
      projectile.g.gameStateMachine.accumulator = time;
      projectile.draw();
      const pose = emitterTargetPose(projectile);
      assert.equal(pose.x, projectile._mc.get_x(), 'attached effect shares predicted position');
      assert.equal(pose.x, 100 + 0.4 * time);
      assert.equal(pose.y, 200 - 0.1 * time);
    }
  }
  assert.deepEqual(projectile.position, { x: 100, y: 200 }, 'physics stays untouched');
  projectile.reset();
  assert.equal(emitterTargetPose(projectile).x, 100, 'pool reset invalidates rendered pose');
  projectile.draw();
  projectile.removeFromCanvas();
  assert.equal(emitterTargetPose(projectile).x, 100, 'detached clip is ignored');
  fixture.dispose();
  assert.equal(Reflect.has(projectile, 'get_renderX'), false, 'unsafe disable removes accessor');
  assert.equal(Object.hasOwn(Projectile.prototype, 'draw'), false, 'inherited draw is restored');
});

test('pooled torpedoes capture the setting at checkout and share the frame timestamp', () => {
  class Projectile {
    alive = true;
    isEnemy = true;
    ai = 'bullet';
    wave = false;
    weapon = { key: xhersixTorpedoWeaponKey };
    course = { time: 1033, pos: { x: 100, y: 200 }, speed: { x: 300, y: -100 } };
    _mc = new Clip();
    constructor(public g: Game) {}
    draw() {}
    get_rotation() {
      return 0;
    }
    update() {}
    reset() {}
  }
  class Manager {
    inactiveProjectiles: Projectile[] = [];
    constructor(public g: Game) {}
    getProjectile() {
      const projectile = this.inactiveProjectiles.pop() ?? new Projectile(this.g);
      projectile.reset();
      return projectile;
    }
  }
  let clockReads = 0;
  class Game {
    time = 990;
    gameStateMachine = { accumulator: 16.5 };
    clock = {
      getServerTime: () => {
        clockReads++;
        return 1000;
      },
    };
    projectiles: Projectile[] = [];
    draw() {
      for (const projectile of this.projectiles) projectile.draw();
    }
  }
  const settings = { correctXhersixTorpedoPrediction: true };
  const fixture = apiFor({
    'core.projectile.Projectile': Projectile,
    'core.projectile.ProjectileManager': Manager,
    'core.scene.Game': Game,
    'core.scene.SceneBase': { clientSettings: settings },
  });
  installProjectileFrames(fixture.api);
  const game = new Game();
  const manager = new Manager(game);
  const first = manager.getProjectile();
  settings.correctXhersixTorpedoPrediction = false;
  const second = manager.getProjectile();
  game.projectiles = [first, second];
  game.draw();
  assert.equal(first._mc.get_x(), 90.1);
  assert.equal(second._mc.get_x(), 104.95);
  assert.equal(clockReads, 1);
  assert.equal(game.time, 990);
  manager.inactiveProjectiles.push(first);
  assert.equal(manager.getProjectile(), first);
  game.draw();
  assert.equal(first._mc.get_x(), 104.95, 'reused particle captures the current disabled option');
  fixture.dispose();
});

test('undrawn body anchors use world coordinates, never a stale clip at the origin', () => {
  class GameObject {
    pos = { x: 1234, y: -567 };
    get_pos() {
      return this.pos;
    }
    get_x() {
      return this.pos.x;
    }
    get_y() {
      return this.pos.y;
    }
    get_rotation() {
      return this.rotation;
    }
    get_hasImage() {
      return this.imgObj !== null;
    }
    removeFromCanvas() {
      this.isAddedToCanvas = false;
    }
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

test('stuck projectiles follow rendered host rotation, then release on exit and pool reset', () => {
  const host = {
    alive: true,
    isAddedToCanvas: true,
    hasRenderPosition: true,
    pos: { x: 100, y: 200 },
    rotation: 0,
    get_pos() {
      return this.pos;
    },
    get_rotation() {
      return this.rotation;
    },
    get_renderX() {
      return this._mc.get_x();
    },
    get_renderY() {
      return this._mc.get_y();
    },
    get_renderRotation() {
      return this._mc.get_rotation();
    },
    _mc: new Clip(),
  };
  host._mc.set_x(110);
  host._mc.set_y(210);
  host._mc.set_rotation(Math.PI / 2);
  class Projectile {
    alive = true;
    course = { pos: { x: 110, y: 200 }, speed: { x: 0, y: 0 } };
    rotation = 0;
    _mc = new Clip();
    g = { gameStateMachine: { accumulator: 16.5 } };
    error = { x: 4, y: 0 };
    convergenceTime = 4;
    convergenceCounter = 1;
    draw() {}
    get_rotation() {
      return 0;
    }
    update() {}
    reset() {}
  }
  class Stuck {
    stuckUnit = host;
    constructor(public p: Projectile) {}
    enter() {}
    exit() {}
  }
  class Game {
    draw() {}
  }
  const fixture = apiFor({
    'core.projectile.Projectile': Projectile,
    'core.scene.Game': Game,
    'core.states.aistates.MissileStuck': Stuck,
  });
  installProjectileFrames(fixture.api);
  const p = new Projectile();
  const state = new Stuck(p);
  state.enter();
  p.draw();
  assert.equal(p._mc.get_x(), 110);
  assert.equal(p._mc.get_y(), 219.5, 'fractional correction rotates with the host');
  assert.equal(p._mc.get_rotation(), Math.PI / 2);
  assert.deepEqual(p.course.pos, { x: 110, y: 200 });
  state.exit();
  p.draw();
  assert.equal(p._mc.get_y(), 200);
  state.enter();
  p.reset();
  p.draw();
  assert.equal(p._mc.get_y(), 200, 'pool reset releases the old host');
  fixture.dispose();
});

test('missile and boomerang trails sample rendered tails and cannot follow a recycled projectile life', () => {
  class Projectile {
    alive = true;
    clip: Clip | null = new Clip();
    get_movieClip() {
      return this.clip;
    }
    get_radius() {
      return 10;
    }
    reset() {
      this.alive = true;
    }
  }
  class Missile {
    engine = {};
    constructor(public p: Projectile) {}
    enter() {}
    execute() {}
  }
  class Boomerang extends Missile {}
  const fixture = apiFor({
    'core.projectile.Projectile': Projectile,
    'core.states.aistates.Missile': Missile,
    'core.states.aistates.Boomerang': Boomerang,
  });
  let pose = { x: 100, y: 200, rotation: 0 };
  installProjectileThrustAnchors(fixture.api, () => pose);
  try {
    for (const State of [Missile, Boomerang]) {
      const projectile = new Projectile();
      const state = new State(projectile);
      state.enter();
      assert.deepEqual(projectileThrustPose(state.engine), { x: 90, y: 200, rotation: 0 });
      pose = { x: 110, y: 220, rotation: Math.PI / 2 };
      assert.deepEqual(
        projectileThrustPose(state.engine),
        { x: 110, y: 210, rotation: 0 },
        'render-frame position and heading update without executing AI',
      );
      projectile.alive = false;
      assert.equal(staleProjectileThrust(state.engine), true);
      projectile.reset();
      state.execute();
      assert.equal(
        staleProjectileThrust(state.engine),
        true,
        'old effects must not reattach when their pooled projectile is reused',
      );
      const nextState = new State(projectile);
      nextState.execute();
      assert.equal(staleProjectileThrust(nextState.engine), false);
      assert.deepEqual(projectileThrustPose(nextState.engine), { x: 110, y: 210, rotation: 0 });
      projectile.clip = null;
      assert.equal(staleProjectileThrust(nextState.engine), true);
      pose = { x: 100, y: 200, rotation: 0 };
    }
  } finally {
    fixture.dispose();
  }
});

test('already attached projectiles follow rendered hosts when hooks are enabled mid-flight', () => {
  const host = {
    alive: true,
    get_pos: () => ({ x: 100, y: 200 }),
    get_rotation: () => 0,
    get_renderX: () => 120,
    get_renderY: () => 230,
    get_renderRotation: () => Math.PI / 2,
  };
  class Projectile {
    alive = true;
    course = { time: 0, pos: { x: 110, y: 200 }, speed: { x: 0, y: 0 } };
    g = { gameStateMachine: { accumulator: 16.5 } };
    _mc = new Clip();
    stateMachine = { currentState: null as Stuck | Missile | null };
    error = { x: 4, y: 0 };
    convergenceTime = 4;
    convergenceCounter = 1;
    get_rotation() {
      return 0;
    }
    draw() {}
    update() {}
    reset() {
      this.stateMachine.currentState = null;
    }
  }
  class Stuck {
    constructor(readonly p: Projectile) {}
    stuckUnit = host;
    enter() {
      throw Error('Do not re-enter live projectile states');
    }
    exit() {}
  }
  class Missile extends Stuck {}
  const projectile = new Projectile();
  projectile.stateMachine.currentState = new Stuck(projectile);
  const f = apiFor({
    'core.projectile.Projectile': Projectile,
    'core.states.aistates.ProjectileStuck': Stuck,
    'core.states.aistates.MissileStuck': Missile,
  });
  installProjectileFrames(f.api);
  try {
    projectile.draw();
    assert.equal(projectile._mc.get_x(), 120);
    assert.equal(projectile._mc.get_y(), 240);
    projectile.stateMachine.currentState = new Missile(projectile);
    projectile.draw();
    assert.equal(projectile._mc.get_y(), 239.5);
    projectile.stateMachine.currentState.exit();
    projectile.draw();
    assert.equal(
      projectile._mc.get_y(),
      200,
      'native exitCurrent retains the pointer, but an exited state must not be adopted again',
    );
    projectile.reset();
    projectile.draw();
    assert.equal(projectile._mc.get_x(), 110);
    assert.equal(projectile._mc.get_y(), 200);
  } finally {
    f.dispose();
  }
});
