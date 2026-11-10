import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EmitterFrames,
  emitterTargetPose,
  installEmitterFrames,
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
  const cls = { POOL_SIZE_MAX: 200, POOL_SIZE_MIN: 2, IS_HIGH_GRAPHICS: false };
  const frames = new EmitterFrames(Particle, cls, { interpolateColor: () => 0 });
  const emitter: Raw = {
    alive: true,
    _duration: -1,
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
    collectiveMeshBatch: { clear() {}, addMesh() {} },
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
  return { frames, emitter };
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('emission counts and particle travel agree at 30, 60, 120 and 180 frame updates', () => {
  let baseline: Particle[] | undefined;
  for (const count of [30, 60, 120, 180]) {
    const { frames, emitter } = fixture();
    for (let index = 0; index < count; index++) frames.update(emitter, 990 / count);
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
  frames.update(emitter, 132);
  assert.equal(emitter.particles.length, 2);
  assert.equal(emitter.isEmitting, false);
  close(emitter.particles[0].x, 6.6);
  close(emitter.particles[1].x, 3.3);
  close(emitter.particles[0].ttl, 4934);
  frames.update(emitter, 5000); // source clamps a stalled frame to 500ms
  close(emitter.particles[0].ttl, 4434);
  frames.update(emitter, NaN);
  close(emitter.particles[0].ttl, 4434);
});

test('stopped constant emitters drain, fractional friction is frame independent, and pooled particles restart', () => {
  for (const count of [1, 6]) {
    const { frames, emitter } = fixture();
    emitter.isEmitting = false;
    emitter.useFriction = true;
    const particle = new Particle();
    emitter.particles.push(particle);
    for (let i = 0; i < count; i++) frames.update(emitter, 33 / count);
    close(particle.speed, 98);
    particle.ttl = 1;
    frames.update(emitter, 2);
    assert.equal(emitter.particles.length, 0);
    assert.equal(emitter.inactiveParticles[0], particle);
    emitter.isEmitting = true;
    frames.reset(emitter);
    frames.update(emitter, 33);
    assert.equal(emitter.particles[0], particle);
    close(particle.ttl, 5000);
  }
});

test('engine visual mounts use rendered ship position and current angle without mutating physics', () => {
  const ship: Raw = {
    alive: true,
    isAddedToCanvas: true,
    enginePos: { x: 10, y: 0 },
    _mc: { get_x: () => 105.5, get_y: () => 207.25, get_rotation: () => Math.PI / 2 },
    get_pos: () => ({ x: 100, y: 200 }),
    get_rotation: () => 0,
  };
  const engine: Raw = { alive: true, ship, get_pos: () => ({ x: 90, y: 200 }) };
  ship.engine = engine;
  const pose = emitterTargetPose(engine);
  close(pose.x, 105.5);
  close(pose.y, 197.25);
  close(pose.rotation, Math.PI * 1.5);
  assert.deepEqual(engine.get_pos(), { x: 90, y: 200 });
  const { frames, emitter } = fixture();
  Object.assign(emitter, { followTarget: true, target: engine, yOffset: 2, angle: 0 });
  frames.update(emitter, 5);
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
    dispose() {}
  }
  const manager = {
    emitters: [emitter],
    update() {
      nativeUpdates++;
    },
    removeEmitter() {},
  };
  const game = { emitterManager: manager, parallaxManager: { update(_seconds: number) {} } };
  const classes: Raw = {
    'core.particle.Emitter': Emitter,
    'core.particle.Particle': Particle,
    'generics.Color': { interpolateColor: () => 0 },
    'core.particle.CollectiveMeshBatch': { AllMeshesAreUpdated: () => batches++ },
  };
  const api: any = {
    cls: (key: string) => classes[key],
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
    onGame: (fn: Function) => fn(game, api),
  };
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
  offscreen.frames.update(offscreen.emitter, 50);
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
  for (let i = 0; i < 12; i++) frames.update(emitter, 5.5);
  assert.equal(columns, 2);
  close(emitter.particles[0].ttl, 4967);
  close(emitter.particles[1].ttl, 5000);
});
