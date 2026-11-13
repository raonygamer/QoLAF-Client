import { drawProjectileFrame } from '../src/rendering/ProjectileFrames';
import type { Projectile } from '../src/game/Bindings';
import { Display } from './fixtures/NativeGame';
import type { Emitter as NativeEmitter, Particle as NativeParticle } from '../src/game/Bindings';
import type { EmitterTargetPose } from '../src/rendering/EmitterTargetPose';
import { bindGameClasses } from '../src/game/Bindings';
import { AuraPulses } from '../src/rendering/AuraPulses';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EmitterFrames,
  emitterTargetPose,
  installEmitterFrames,
  emitterCullingRadius,
  updateEmitterVisibility,
} from '../src/rendering/EmitterFrames';
import { installWorldLabels } from '../src/rendering/WorldLabels';
import type { Raw } from '../src/api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

class Particle {
  x = 0;
  y = 0;
  rotation = 0;
  ttl = 5000;
  totalTtl = 5000;
  speed = 100;
  startSize = 1;
  finishSize = 0;
  startAlpha = 1;
  finishAlpha = 0;
  localPosX = 0;
  localPosY = 0;
  ticks = 0;
  get_x() {
    return this.x;
  }
  get_y() {
    return this.y;
  }
  get_rotation() {
    return this.rotation;
  }
  set_x(v: number) {
    this.x = v;
  }
  set_y(v: number) {
    this.y = v;
  }
  set_rotation(v: number) {
    this.rotation = v;
  }
  set_scaleX(_v: number) {}
  set_scaleY(_v: number) {}
  set_color(_v: number) {}
  set_blendMode(_v: string) {}
}
function fixture() {
  const cls = {
    POOL_SIZE_MAX: 200,
    POOL_SIZE_MIN: 2,
    IS_HIGH_GRAPHICS: false,
    setHighGraphics() {},
  };
  const frames = new EmitterFrames(Particle as unknown as new () => NativeParticle, cls, {
    interpolateColor: () => 0,
  });
  const emitter: Raw = {
    alive: true,
    _duration: -1,
    ttl: 3300,
    delay: 0,
    timeElapsed: 0,
    isEmitting: true,
    particles: [] as Particle[],
    inactiveParticles: [] as Particle[],
    emittAccum: 0,
    nextDistanceCalculation: 1000,
    isOnScreen: true,
    forceUpdate: false,
    global: false,
    followTarget: false,
    followEmitter: false,
    steadyStream: true,
    posX: 0,
    posY: 0,
    gravityX: 0,
    gravityY: 0,
    angle: 0,
    yOffset: 0,
    useFriction: false,
    get_constantEmitter() {
      return this._duration === -1;
    },
    get_ppms: () => 1 / 33,
    get_maxParticles: () => 100,
    updateOnScreen() {
      this.nextDistanceCalculation = 1000;
    },
    setParticlesInactive() {
      this.inactiveParticles.push(...this.particles);
      this.particles.length = 0;
    },
    setBatchParent() {},
    collectiveMeshBatch: {
      clear() {},
      canAddMesh() {
        return true;
      },
      addMesh() {},
    },
    add() {
      const p = this.inactiveParticles.pop();
      if (!p) return;
      Object.assign(p, new Particle());
      this.particles.push(p);
    },
    remove(particle: Particle, index: number) {
      this.particles.splice(index, 1);
      this.inactiveParticles.push(particle);
    },
  };
  return { frames, emitter, cls };
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('emission counts and particle travel agree at 30, 60, 120 and 180 frame updates', () => {
  let baseline: Particle[] | undefined;
  for (const count of [30, 60, 120, 180]) {
    const { frames, emitter } = fixture();
    for (let index = 0; index < count; index++)
      frames.update(emitter as NativeEmitter, 990 / count);
    assert.equal(emitter.particles.length, 30);
    close(emitter.emittAccum, 0);
    close(emitter.timeElapsed, 990);
    if (baseline)
      emitter.particles.forEach((p: Particle, i: number) => {
        close(p.x, baseline![i].x);
        close(p.ttl, baseline![i].ttl);
      });
    else baseline = emitter.particles;
  }
});

test('delay and end boundaries age new particles only for their actual time alive', () => {
  const { frames, emitter } = fixture();
  emitter._duration = 66;
  emitter.delay = 33;
  frames.update(emitter as NativeEmitter, 132);
  assert.equal(emitter.particles.length, 2);
  assert.equal(emitter.isEmitting, false);
  close(emitter.particles[0].x, 6.6);
  close(emitter.particles[1].x, 3.3);
  close(emitter.particles[0].ttl, 4934);
  frames.update(emitter as NativeEmitter, 5000); // source clamps a stalled frame to 500ms
  close(emitter.particles[0].ttl, 4434);
  frames.update(emitter as NativeEmitter, NaN);
  close(emitter.particles[0].ttl, 4434);
});

test('stopped constant emitters drain, fractional friction is frame independent, and pooled particles restart', () => {
  for (const count of [1, 6]) {
    const { frames, emitter } = fixture();
    emitter.isEmitting = false;
    emitter.useFriction = true;
    const particle = new Particle();
    emitter.particles.push(particle);
    for (let i = 0; i < count; i++) frames.update(emitter as NativeEmitter, 33 / count);
    close(particle.speed, 98);
    particle.ttl = 1;
    frames.update(emitter as NativeEmitter, 2);
    assert.equal(emitter.particles.length, 0);
    assert.equal(emitter.inactiveParticles[0], particle);
    emitter.isEmitting = true;
    frames.reset(emitter as NativeEmitter);
    frames.update(emitter as NativeEmitter, 33);
    assert.equal(emitter.particles[0], particle);
    close(particle.ttl, 5000);
  }
});

test('engine visual mounts use rendered ship position and current angle without mutating physics', () => {
  const ship: EmitterTargetPose & {
    engine: EmitterTargetPose | null;
    enginePos: { x: number; y: number };
  } = {
    engine: null,
    alive: true,
    isAddedToCanvas: true,
    enginePos: { x: 10, y: 0 },
    _mc: { get_x: () => 105.5, get_y: () => 207.25, get_rotation: () => Math.PI / 2 },
    get_pos: () => ({ x: 100, y: 200 }),
    get_rotation: () => 0,
  };
  const engine: EmitterTargetPose = {
    alive: true,
    ship,
    get_pos: () => ({ x: 90, y: 200 }),
    get_rotation: () => 0,
  };
  ship.engine = engine;
  const pose = emitterTargetPose(engine);
  close(pose.x, 105.5);
  close(pose.y, 197.25);
  close(pose.rotation, Math.PI * 1.5);
  assert.deepEqual(engine.get_pos(), { x: 90, y: 200 });
  const { frames, emitter } = fixture();
  Object.assign(emitter, { followTarget: true, target: engine, yOffset: 2, angle: 0 });
  frames.update(emitter as NativeEmitter, 5);
  close(emitter.angle, pose.rotation + Math.PI);
  close(emitter.posX, pose.x + Math.cos(emitter.angle + Math.atan(2)) * 2);
});

test('AF/pet labels follow each rendered pose after native draw, including sub-tick frames', () => {
  const hooks = new Hooks(),
    cleanups: (() => void)[] = [];
  class Enemy {
    isAddedToCanvas = true;
    renderX = 1.25;
    renderY = 2.5;
    _mc = {
      x: 0,
      y: 0,
      get_x() {
        return this.x;
      },
      get_y() {
        return this.y;
      },
    };
    AFName = {
      x: 0,
      y: 0,
      set_x(x: number) {
        this.x = x;
      },
      set_y(y: number) {
        this.y = y;
      },
    };
    draw() {
      this.AFName.set_x(0);
      this.AFName.set_y(-30); // native tick-position label
      this._mc.x = this.renderX;
      this._mc.y = this.renderY;
    }
  }
  bindGameClasses({ cls: () => Enemy } as any);
  installWorldLabels({
    cls: () => Enemy,
    after: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
  } as any);
  const ship = new Enemy();
  for (let i = 0; i < 6; i++) {
    ship.renderX += 0.25;
    ship.renderY += 0.5;
    ship.draw();
    assert.equal(ship.AFName.x, ship.renderX);
    assert.equal(ship.AFName.y, ship.renderY - 30);
  }
  cleanups.reverse().forEach((fn) => fn());
  ship.draw();
  assert.equal(ship.AFName.x, 0);
});

test('manager runs emitters once per render frame, suppresses tick calls, and restores on cleanup', () => {
  const { emitter } = fixture();
  const hooks = new Hooks(),
    cleanups: (() => void)[] = [];
  let nativeUpdates = 0,
    batches = 0;
  class Emitter {
    static POOL_SIZE_MAX = 100;
    static IS_HIGH_GRAPHICS = true;
    static setHighGraphics() {
      this.POOL_SIZE_MAX = 100;
    }
    updateOnScreen() {}
    update() {}
    play() {}
    killEmitter() {}
    removeFromCollectiveMeshBatch() {}
    dispose() {}
  }
  const manager = {
    emitters: [emitter],
    update() {
      nativeUpdates++;
    },
    removeEmitter() {},
  };
  class GameScene {}
  const game = Object.assign(new GameScene(), {
    get_isLeaving: () => false,
    emitterManager: manager,
    parallaxManager: { update(_seconds: number) {} },
  });
  const classes: Raw = {
    'core.scene.Game': GameScene,
    'core.particle.Emitter': Emitter,
    'core.particle.Particle': Particle,
    'generics.Color': { interpolateColor: () => 0 },
    'core.particle.CollectiveMeshBatch': { AllMeshesAreUpdated: () => batches++, disposeAll() {} },
  };
  const api: any = {
    cls: (key: string) => classes[key],
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    after: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    onGame: (fn: Function) => fn(game, api),
  };
  class BindingFixture {
    initEffects() {}
    destroy() {}
    removeEmitter() {}
    loadKey() {
      return null;
    }
    static resolveTexture() {
      return null;
    }
    getEmitter() {
      return null;
    }
    static create() {
      return [];
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
  for (let i = 0; i < 6; i++) {
    manager.update();
    game.parallaxManager.update(0.0055);
  }
  assert.equal(nativeUpdates, 0);
  assert.equal(batches, 6);
  close(emitter.timeElapsed, 33);
  assert.equal(emitter.particles.length, 1);
  cleanups.reverse().forEach((fn) => fn());
  manager.update();
  assert.equal(nativeUpdates, 1);
});

test('offscreen finite emitters age without spawning and native rainbow columns retain their cadence', () => {
  const offscreen = fixture();
  Object.assign(offscreen.emitter, { _duration: 40, isOnScreen: false });
  offscreen.frames.update(offscreen.emitter as NativeEmitter, 50);
  assert.equal(offscreen.emitter.alive, false);
  assert.equal(offscreen.emitter.particles.length, 0);
  const { frames, emitter } = fixture();
  emitter.rainbow = true;
  emitter._txt = { get_width: () => 8 };
  let columns = 0;
  emitter.addRainbowColumn = () => {
    columns++;
    const particle = new Particle() as Particle & { rainbowLength: number };
    particle.rainbowLength = 12;
    emitter.particles.push(particle);
  };
  for (let i = 0; i < 12; i++) frames.update(emitter as NativeEmitter, 5.5);
  assert.equal(columns, 2);
  close(emitter.particles[0].ttl, 4967);
  close(emitter.particles[1].ttl, 5000);
});

test('large effects stay visible beyond the native 100-unit origin radius', () => {
  const { frames, emitter: base } = fixture();
  const emitter = Object.assign(base, {
    canvasTarget: null as object | null,
    distanceToCamera: 0,
    distanceToCameraX: 0,
    distanceToCameraY: 0,
    posX: 250,
    posY: 0,
    sourceVarianceX: -20,
    sourceVarianceY: 5,
    speed: -100,
    ttl: 1500,
    ttlVariance: -500,
    get_radius: () => 60,
    nextDistanceCalculation: 0,
    isOnScreen: false,
    forceUpdate: true,
    MAX_CALC_DELAY: 500,
    g: {
      camera: {
        isCircleOnScreen: (x: number, _y: number, radius: number) => x <= radius,
        getCameraCenter: () => ({ x: 0, y: 0 }),
      },
    },
    updateOnScreen() {
      updateEmitterVisibility(this);
    },
  });
  assert.equal(emitterCullingRadius(emitter), 280);
  assert.equal(emitter.g.camera.isCircleOnScreen(250, 0, 100), false);
  frames.update(emitter as NativeEmitter, 33);
  assert.equal(emitter.isOnScreen, true);
  assert.equal(emitter.forceUpdate, false);
  assert.equal(emitter.nextDistanceCalculation, 1000);
  // A 100-particle steady stream with a 1500 ms lifetime emits two particles
  // in 33 ms. Visibility must preserve both, independently of the old tick rate.
  assert.equal(emitter.particles.length, 2, 'visible particle footprint must not be discarded');

  emitter.posX = 300.5;
  emitter.posY = 0.25;
  updateEmitterVisibility(emitter);
  assert.equal(emitter.isOnScreen, false);
  assert.equal(emitter.distanceToCameraX, 300.5);
  assert.equal(emitter.distanceToCameraY, 0.25);
  close(emitter.nextDistanceCalculation, Math.hypot(300.5, 0.25));
  emitter.posX = 2000;
  updateEmitterVisibility(emitter);
  assert.ok(emitter.nextDistanceCalculation >= 500 && emitter.nextDistanceCalculation < 700);

  emitter.canvasTarget = {};
  emitter.g.camera.isCircleOnScreen = () => {
    throw Error('canvas effects bypass camera culling');
  };
  updateEmitterVisibility(emitter);
  assert.equal(emitter.isOnScreen, true);
  assert.equal(emitter.nextDistanceCalculation, 1000);
  Object.assign(emitter, { sourceVarianceX: 0, sourceVarianceY: 0, speed: 0, ttl: 0 });
  assert.equal(emitterCullingRadius(emitter), 100);
});

test('frame rendering restores native size, tint and alpha immediately when aura breathing is disabled', () => {
  const { emitter } = fixture();
  let enabled = true;
  const Color = {
    interpolateColor: (_start: number, _end: number, fraction: number) =>
      fraction === 0.42 ? 42 : 50,
  };
  const pulses = new AuraPulses(() => enabled, Color);
  const frames = new EmitterFrames(
    Particle as unknown as new () => NativeParticle,
    { POOL_SIZE_MAX: 200, POOL_SIZE_MIN: 2, IS_HIGH_GRAPHICS: false, setHighGraphics() {} },
    Color,
    undefined,
    undefined,
    pulses,
  );
  const particle = new Particle() as Raw;
  Object.assign(particle, {
    ttl: 1000,
    totalTtl: 2000,
    speed: 0,
    set_scaleX(this: Raw, value: number) {
      this.scaleX = value;
    },
    set_scaleY(this: Raw, value: number) {
      this.scaleY = value;
    },
    set_color(this: Raw, value: number) {
      this.color = value;
    },
  });
  let alpha = 0;
  Object.assign(emitter, {
    isEmitting: false,
    timeElapsed: 1500,
    mirrorY: true,
    _startSize: 2,
    _finishSize: 4,
    particles: [particle],
    collectiveMeshBatch: {
      clear() {},
      canAddMesh() {
        return true;
      },
      addMesh(_particle: Raw, _matrix: Raw, opacity: number) {
        alpha = opacity;
      },
    },
  });
  pulses.prepare(emitter, 1);
  frames.update(emitter as NativeEmitter, 0);
  close(particle.scaleX, 3.054);
  close(particle.scaleY, -3.054);
  assert.equal(particle.color, 42);
  close(alpha, 1.05);
  enabled = false;
  frames.update(emitter as NativeEmitter, 0);
  close(particle.scaleX, 0.5);
  close(particle.scaleY, -0.5);
  assert.equal(particle.color, 50);
  close(alpha, 0.5);
  enabled = true;
  frames.update(emitter as NativeEmitter, 0);
  close(particle.scaleX, 3.054);
  close(particle.scaleY, -3.054);
  close(alpha, 1.05);
  pulses.release(emitter);
  frames.update(emitter as NativeEmitter, 0);
  close(particle.scaleX, 0.5);
  close(alpha, 0.5);
});

test('steady emission preserves its fractional phase across shared pool-budget changes', () => {
  const { frames, emitter, cls } = fixture();
  frames.update(emitter as NativeEmitter, 16.5);
  close(emitter.emittAccum, 0.5);
  cls.POOL_SIZE_MAX = 10;
  frames.update(emitter as NativeEmitter, 33);
  close(emitter.emittAccum, 0.6);
  assert.equal(emitter.particles.length, 0);
  cls.POOL_SIZE_MAX = 200;
  frames.update(emitter as NativeEmitter, 13.2);
  assert.equal(emitter.particles.length, 1);
  close(emitter.emittAccum, 0);
  close(emitter.particles[0].ttl, 5000);
  const original = emitter.particles[0];
  emitter.isEmitting = false;
  original.ttl = 1;
  frames.update(emitter as NativeEmitter, 2);
  assert.equal(emitter.particles.length, 0);
  assert.equal(emitter.inactiveParticles[0], original);
  frames.restart(emitter as NativeEmitter);
  emitter.isEmitting = true;
  frames.update(emitter as NativeEmitter, 33);
  assert.equal(emitter.particles[0], original);
  close(original.ttl, 5000);
});

test('burst emission retains its authored rate while respecting a reduced shared pool limit', () => {
  const { frames, emitter, cls } = fixture();
  emitter._duration = 330;
  cls.POOL_SIZE_MAX = 2;
  frames.update(emitter as NativeEmitter, 99);
  assert.equal(emitter.particles.length, 2);
  close(emitter.emittAccum, 0);
  close(emitter.particles[0].ttl, 4934);
  close(emitter.particles[1].ttl, 4967);
});

test('concussion core follows predicted frames while its authored trail stays at birth positions', () => {
  // Current loaded Thrust Concussion Sphere: the 90ms core follows its emitter;
  // the 200ms trail follows only at birth. Both use zero particle speed.
  for (const fps of [60, 120, 180]) {
    const core = fixture(),
      trail = fixture();
    const clip = Object.assign(new Display(), { set_rotation(_value: number) {} });
    const course = { time: 1000, pos: { x: 100, y: 200 }, speed: { x: 300, y: -100 } };
    const game = { gameStateMachine: { accumulator: 0 } };
    const projectile = {
      alive: true,
      _mc: clip,
      course,
      g: game,
      get_rotation: () => 0,
      get_pos: () => course.pos,
      get_renderX: () => clip.get_x(),
      get_renderY: () => clip.get_y(),
      get_renderRotation: () => 0,
    };
    for (const [effect, follows, ttl] of [
      [core, true, 90],
      [trail, false, 200],
    ] as const) {
      effect.emitter.target = projectile;
      effect.emitter.followTarget = true;
      effect.emitter.followEmitter = follows;
      effect.emitter.isEmitting = false;
      effect.emitter.particles.push(
        Object.assign(new Particle(), {
          speed: 0,
          ttl,
          totalTtl: ttl,
          x: 100,
          y: 200,
        }),
      );
    }
    for (let elapsed = 1000 / fps; elapsed < 66; elapsed += 1000 / fps) {
      const tick = Math.floor(elapsed / 33) * 33;
      course.time = 1000 + tick;
      course.pos.x = 100 + 0.3 * tick;
      course.pos.y = 200 - 0.1 * tick;
      game.gameStateMachine.accumulator = elapsed - tick;
      const before = structuredClone(course);
      drawProjectileFrame(projectile as unknown as Projectile, 0);
      core.frames.update(core.emitter as NativeEmitter, 1000 / fps);
      trail.frames.update(trail.emitter as NativeEmitter, 1000 / fps);
      close(core.emitter.particles[0].x, 100 + 0.3 * elapsed);
      close(core.emitter.particles[0].y, 200 - 0.1 * elapsed);
      close(trail.emitter.particles[0].x, 100);
      close(trail.emitter.particles[0].y, 200);
      assert.deepEqual(course, before, 'drawing and particles leave physics unchanged');
    }
  }
});
