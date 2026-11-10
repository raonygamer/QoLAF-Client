import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installProjectileFrames } from '../src/rendering/ProjectileFrames';
// @ts-expect-error extracted native Haxe methods
import { InstantPrototype, InstantSplittingPrototype } from './fixtures/NativeInstant.js';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(splitting: boolean) {
  const released: any[] = [];
  const cleanup: Function[] = [];
  const hooks = new Hooks();
  const clip = {
    x: 0,
    y: 0,
    rotation: 0,
    set_x(v: number) {
      this.x = v;
    },
    set_y(v: number) {
      this.y = v;
    },
    set_rotation(v: number) {
      this.rotation = v;
    },
  };
  const canvas = {
    addChild(line: any) {
      line.parent = this;
    },
    removeChild(line: any) {
      line.parent = null;
    },
  };
  const game = {
    gameStateMachine: { accumulator: 0 },
    canvasEffects: canvas,
    beamLinePool: {
      getLine: () => ({
        parent: null,
        x: 0,
        y: 0,
        alpha: 0,
        visible: false,
        thickness: 0,
        end: [0, 0],
        init() {},
        clear() {},
        set_x(v: number) {
          this.x = v;
        },
        set_y(v: number) {
          this.y = v;
        },
        set_alpha(v: number) {
          this.alpha = v;
        },
        set_visible(v: boolean) {
          this.visible = v;
        },
        lineTo(x: number, y: number) {
          this.end = [x, y];
        },
      }),
      removeLine(line: any) {
        released.push(line);
      },
    },
  };
  class Projectile {
    g = game;
    alive = true;
    _mc = clip;
    rotation = 0;
    course = { pos: { x: 25, y: 50 }, speed: { x: 900, y: -500 }, time: 0 };
    range = 100;
    ttl = 100;
    ttlMax = 100;
    weapon = { range: 100, maxProjectiles: 0 };
    get_pos() {
      return this.course.pos;
    }
    get_rotation() {
      return this.rotation;
    }
    update() {}
    reset() {}
    draw() {}
  }
  function State() {}
  State.prototype = { ...(splitting ? InstantSplittingPrototype : InstantPrototype) };
  const classes: any = {
    'core.projectile.Projectile': Projectile,
    'core.scene.Game': { prototype: { draw() {}, exit() {} } },
    ['core.states.aistates.' + (splitting ? 'InstantSplitting' : 'Instant')]: State,
  };
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
  };
  for (const type of ['before', 'after', 'around'])
    api[type] = (object: any, name: string, fn: Function) =>
      cleanup.push(hooks.add(object, name, type, fn));
  installProjectileFrames(api);
  const p = new Projectile();
  const state: any = Object.assign(Object.create(State.prototype), {
    p,
    g: game,
    tick: 0,
    lines: [],
    alpha: 0.8,
    thickness: 4,
    frequency: 1,
    amplitude: 0,
    color: 123,
    glowColor: 456,
    texture: 'line2',
  });
  return {
    p,
    state,
    game,
    released,
    exitGame: () => classes['core.scene.Game'].prototype.exit.call(game),
    dispose: () => cleanup.reverse().forEach((fn) => fn()),
  };
}

for (const splitting of [false, true]) {
  test(`${splitting ? 'splitting' : 'instant'} room exit returns active lines before teardown`, () => {
    const { state, released, exitGame, dispose } = fixture(splitting);
    state.enter();
    exitGame();
    assert.equal(released.length, splitting ? 1 : 2);
    dispose();
    assert.equal(released.length, splitting ? 1 : 2);
  });
  test(`${splitting ? 'splitting' : 'instant'} native rays fade at display rate without drifting or aging simulation`, () => {
    const { p, state, game, released, dispose } = fixture(splitting);
    state.enter();
    state.execute();
    const line = splitting ? state.lines[0] : state.lineOuter;
    assert.ok(line);
    for (const fps of [60, 120, 180]) {
      let last = Infinity;
      for (let time = 0; time < 33; time += 1000 / fps) {
        game.gameStateMachine.accumulator = time;
        p.draw();
        assert.equal(line.x, 25);
        assert.equal(line.y, 50);
        assert.deepEqual(line.end, [splitting ? 225 : 125, 50]);
        assert.equal(p._mc.x, 25, 'inherited course velocity must not move the muzzle');
        assert.ok(line.alpha < last);
        assert.ok(Math.abs(line.alpha - (0.8 * (100 - time)) / 100) < 1e-10);
        last = line.alpha;
      }
    }
    assert.equal(p.ttl, 100);
    assert.deepEqual(p.course.pos, { x: 25, y: 50 });
    state.exit();
    state.exit();
    assert.equal(released.length, splitting ? 1 : 2);
    assert.equal(line.parent, null);
    dispose();
    assert.equal(released.length, splitting ? 1 : 2);
  });

  test(`${splitting ? 'splitting' : 'instant'} death and pool reset release native lines exactly once`, () => {
    const { p, state, released, dispose } = fixture(splitting);
    state.enter();
    p.alive = false;
    state.execute();
    state.execute();
    state.exit();
    p.reset();
    assert.equal(released.length, splitting ? 1 : 2);
    assert.equal(p.course.time, splitting ? 0 : 66, 'native simulation clock retained');
    p.alive = true;
    state.enter();
    p.reset();
    assert.equal(released.length, splitting ? 2 : 4);
    dispose();
  });
}
