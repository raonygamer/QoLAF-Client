import { test } from 'node:test';
import { XhersixTorpedoCueClock } from '../src/projectile/XhersixTorpedoCueClock';
// @ts-expect-error original JavaScript contract cases
import { runClockContract } from './fixtures/XhersixTorpedoCueClockContract.js';
test('original Xhersix rhythm clock cadence, drift, expiry and wrap contracts', () =>
  runClockContract(() => new XhersixTorpedoCueClock()));

import assert from 'node:assert/strict';
import { Display } from './fixtures/NativeGame';
import { EnemyTargetObservations } from '../src/projectile/EnemyTargetObservations';
import {
  XhersixTorpedoCue,
  xhersixTorpedoWeaponKey,
  installTorpedoCue,
  installTorpedoCueHooks,
} from '../src/projectile/XhersixTorpedoCue';
import { XhersixTorpedoCueView } from '../src/projectile/XhersixTorpedoCueView';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function cueFixture() {
  class Roaming {}
  const owner: any = {
    id: 42,
    alive: true,
    isAddedToCanvas: true,
    radius: 50,
    movieClip: new Display(),
  };
  owner.movieClip.set_x(120);
  owner.movieClip.set_y(230);
  owner.movieClip.set_alpha(0.7);
  const game: any = {
    stage: {},
    canvas: new Display(),
    canvasTexts: new Display(),
    me: { ship: { alive: true } },
    gameStateMachine: { currentState: new Roaming() },
    unitManager: { getTarget: (id: number) => (id === 42 ? owner : null) },
  };
  const classes: any = { 'core.states.gameStates.RoamingState': Roaming };
  const api: any = {
    cls: (name: string) => classes[name],
    log: (...args: any[]) => assert.fail(String(args)),
  };
  return { owner, game, classes, api };
}

test('torpedo cue filters duplicate volleys, hides outside combat and invalidates pooled lives and target changes', () => {
  const { owner, game, api } = cueFixture();
  let now = 100,
    created = 0,
    disposed = 0;
  const calls: any[] = [];
  const node = new Display();
  const identities = new EnemyTargetObservations();
  const cue = new XhersixTorpedoCue(
    api,
    game,
    identities,
    () => now,
    () => {
      created++;
      return {
        node,
        updateCue: (...args: any[]) => {
          calls.push(args);
          node.set_visible(true);
        },
        dispose: () => disposed++,
      } as any;
    },
  );
  cue.observe(42, xhersixTorpedoWeaponKey, now, 1000);
  cue.updateFrame();
  assert.equal(created, 0, 'disabled by default');
  cue.setEnabled(true);
  cue.observe(42, 'other', now, 1000);
  cue.updateFrame();
  assert.equal(created, 0);
  cue.observe(42, xhersixTorpedoWeaponKey, now, 1000);
  cue.updateFrame();
  assert.equal(created, 1);
  assert.deepEqual(calls.at(-1), [120, 230, 50, 0, 0, 1, 0]);
  assert.equal(node.get_alpha(), 0.7);
  now = 2600;
  cue.observe(42, xhersixTorpedoWeaponKey, now, 3500);
  cue.updateFrame();
  assert.equal(calls.at(-1)[4], 1);
  now = 5650;
  cue.updateFrame();
  assert.equal(node.get_visible(), false);
  cue.observe(42, xhersixTorpedoWeaponKey, now, 3500);
  cue.updateFrame();
  assert.equal(node.get_visible(), false, 'late duplicate cannot rearm expired cadence');
  cue.observe(42, xhersixTorpedoWeaponKey, now, 6000);
  cue.updateFrame();
  assert.equal(node.get_visible(), true);
  identities.record(owner, 5);
  identities.record(owner, 7);
  identities.record(owner, 5);
  cue.updateFrame();
  assert.equal(node.get_visible(), false, 'A to B to A still invalidates cadence');
  cue.observe(42, xhersixTorpedoWeaponKey, now, 8500);
  cue.updateFrame();
  identities.reset(owner);
  cue.updateFrame();
  assert.equal(node.get_visible(), false);
  cue.observe(42, xhersixTorpedoWeaponKey, now, 11000);
  cue.updateFrame();
  game.gameStateMachine.currentState = {};
  cue.updateFrame();
  assert.equal(node.get_visible(), false);
  cue.setEnabled(false);
  cue.dispose();
  assert.equal(disposed, 1);
  assert.equal(created, 1, 'mesh view is reused');
});

test('native torpedo rings keep source geometry, pulse fade and screen-constant strokes', () => {
  class Vertices {
    count = 0;
    set_numVertices(count: number) {
      this.count = count;
    }
  }
  class Indices {
    quads: number[][] = [];
    addQuad(...args: number[]) {
      this.quads.push(args);
    }
  }
  class Mesh extends Display {
    points: number[][] = [];
    color = 0;
    constructor(
      public vertices: Vertices,
      public indices: Indices,
    ) {
      super();
    }
    set_color(value: number) {
      this.color = value;
    }
    setVertexPosition(i: number, x: number, y: number) {
      this.points[i] = [x, y];
    }
  }
  const classes: any = {
    'starling.display.Sprite': Display,
    'starling.display.Mesh': Mesh,
    'starling.rendering.VertexData': Vertices,
    'starling.rendering.IndexData': Indices,
  };
  const view = new XhersixTorpedoCueView({ cls: (name: string) => classes[name] } as any);
  const node = view.node as any,
    rings = node.children as Mesh[];
  new Display().addChild(node);
  view.updateCue(10, 20, 50, 1250, 1, 2, 300);
  assert.equal(node.get_visible(), true);
  assert.equal(node.get_x(), 10);
  assert.deepEqual(
    rings.map((ring) => ring.color),
    [0xff4040, 0xff4040, 0xffdc55],
  );
  for (const [index, radius] of [68, 218, 218].entries()) {
    const ring = rings[index];
    assert.equal(ring.vertices.count, 130);
    assert.equal(ring.indices.quads.length, 64);
    for (let i = 0; i <= 64; i++) {
      assert.ok(Math.abs(Math.hypot(...ring.points[i * 2]) - radius - 0.5) < 1e-8);
      assert.ok(Math.abs(Math.hypot(...ring.points[i * 2 + 1]) - radius + 0.5) < 1e-8);
    }
  }
  assert.equal(rings[2].get_alpha(), 0.45);
  view.updateCue(10, 20, 50, 0, 1, 1, 700);
  assert.equal(rings[2].get_visible(), false, 'late realignment cannot replay pulse');
  view.updateCue(NaN, 20, 50, 0, 1);
  assert.equal(node.get_visible(), false);
  view.dispose();
  assert.equal(node.disposed, true);
});

test('early packet hooks survive cached handlers and observe before native factory culling', () => {
  const { game, owner, classes, api } = cueFixture();
  const hooks = new Hooks(),
    rootCleanup: Function[] = [],
    sessionCleanup: Function[] = [];
  let nativeCalls = 0;
  const factory = {
    create(_type: any, _game: any, _owner: any, _weapon: any, heading: any) {
      nativeCalls++;
      heading.time = 9999;
      return null;
    },
  };
  class Manager {
    constructor(public g: any) {}
    addEnemyProjectile(heading: any) {
      return factory.create('bullet', this.g, owner, { key: xhersixTorpedoWeaponKey }, heading);
    }
  }
  classes['core.projectile.ProjectileManager'] = Manager;
  classes['core.projectile.ProjectileFactory'] = factory;
  classes['core.scene.SceneBase'] = { clientSettings: { showXhersixTorpedoRhythm: true } };
  const makeApi = (cleanups: Function[]) => ({
    ...api,
    before: (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'before', fn)),
    after: (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'after', fn)),
    around: (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'around', fn)),
    defer: (fn: Function) => cleanups.push(fn),
    on() {},
  });
  installTorpedoCueHooks(makeApi(rootCleanup));
  game.projectileManager = new Manager(game);
  const cachedHandler = game.projectileManager.addEnemyProjectile.bind(game.projectileManager);
  const cue = installTorpedoCue(makeApi(sessionCleanup), game);
  const observations: any[] = [];
  cue.observe = (...args: any[]) => {
    observations.push(args);
  };
  const heading = { time: 1234 };
  assert.equal(cachedHandler(heading), null);
  assert.equal(nativeCalls, 1);
  assert.equal(heading.time, 9999, 'native simulation is untouched');
  assert.equal(observations.length, 1);
  assert.equal(observations[0][3], 1234, 'raw spawn time before catch-up');
  game.projectileManager.setTorpedoCueEnabled(false);
  cachedHandler({ time: 2000 });
  assert.equal(observations.length, 1);
  factory.create('bullet', game, owner, { key: xhersixTorpedoWeaponKey }, { time: 3000 });
  assert.equal(observations.length, 1, 'outside enemy packet cannot anchor rhythm');
  sessionCleanup.reverse().forEach((fn) => fn());
  rootCleanup.reverse().forEach((fn) => fn());
  assert.equal('setTorpedoCueEnabled' in game.projectileManager, false);
});

import { observeEnemyTargets } from '../src/projectile/EnemyTargetObservations';
// @ts-expect-error actual Haxe parser fixture
import { createReader } from './fixtures/NativeEnemyEntry.js';

test('target observation follows native packet masks, preserves aggro across weapon stop and resets on pooled reuse', () => {
  const observations = new EnemyTargetObservations(),
    hooks = new Hooks(),
    cleanups: Function[] = [];
  const unit: any = {
    id: 42,
    hp: 100,
    shieldHp: 100,
    get_hpMax: () => 100,
    get_shieldHpMax: () => 100,
    weapons: [{ set_fire() {} }],
  };
  class Unit {
    g: any;
    reset() {}
    destroy() {}
  }
  class Heading {
    parseMessage(_message: any, start: number) {
      return start + 10;
    }
  }
  class Manager {
    enemiesById = { h: { '42': unit } };
    constructor(public g: any) {}
    declare readEnemyEntry: any;
    enemyFire() {}
    onEnemyUpdate() {}
    syncEnemyTarget() {}
    getShipFromId(id: number) {
      return { id };
    }
  }
  Manager.prototype.readEnemyEntry = createReader(Heading);
  const game: any = {};
  game.shipManager = new Manager(game);
  const classes: any = { 'core.ship.ShipManager': Manager, 'core.unit.Unit': Unit };
  observeEnemyTargets(
    {
      cls: (name: string) => classes[name],
      before: (target: any, name: string, fn: Function) =>
        cleanups.push(hooks.add(target, name, 'before', fn)),
      after: (target: any, name: string, fn: Function) =>
        cleanups.push(hooks.add(target, name, 'after', fn)),
    } as any,
    (candidate) => (candidate === game ? observations : undefined),
  );
  const message = (values: any[]) => ({
    length: values.length,
    getInt: (i: number) => values[i],
    getBoolean: (i: number) => values[i],
  });
  const manager: any = game.shipManager;
  manager.readEnemyEntry(message([42, 24, 18, 1]), 0);
  assert.equal(observations.revision(unit), 1);
  assert.equal(unit.weapons[0].target.id, 17);
  manager.readEnemyEntry(message([42, 24, 18, 0]), 0);
  assert.equal(observations.revision(unit), 1, 'fire mask does not change raw aggro');
  manager.enemyFire(message([42, 0, false, 0]));
  assert.equal(observations.revision(unit), 1);
  manager.enemyFire(message([42, 0, true, 19]));
  assert.equal(observations.revision(unit), 2);
  manager.onEnemyUpdate(message([42, 100, 100, 17, true]));
  assert.equal(observations.revision(unit), 3, 'A to B to A');
  manager.readEnemyEntry(message([42, 8, 0]), 0);
  assert.equal(observations.revision(unit), 4);
  manager.onEnemyUpdate(message([42, 100, 100, 0, false]));
  assert.equal(observations.revision(unit), 4, 'encoded and raw clears agree');
  const pooled = new Unit();
  pooled.g = game;
  observations.record(pooled, 17);
  pooled.reset();
  assert.equal(observations.revision(pooled), 0);
  assert.equal(observations.life(pooled), 1);
  cleanups.reverse().forEach((fn) => fn());
});
