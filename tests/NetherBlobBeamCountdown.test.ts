import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Display } from './fixtures/NativeGame';
import {
  NetherBlobBeamCountdown,
  installNetherBlobBeamHooks,
  installNetherBlobBeamCountdown,
} from '../src/ship/NetherBlobBeamCountdown';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  let fallback = 2000,
    loads = 0;
  const labels: Label[] = [];
  class Format {
    constructor(
      public font: string,
      public size: number,
      public color: number,
    ) {}
  }
  class Label extends Display {
    writes = 0;
    text = '';
    constructor(
      public width: number,
      public height: number,
      _text: string,
      public format: Format,
    ) {
      super();
      labels.push(this);
    }
    set_text(value: string) {
      this.text = value;
      this.writes++;
    }
    set_pivotX(value: number) {
      this.values.pivotX = value;
    }
    set_batchable(value: boolean) {
      this.values.batchable = value;
    }
  }
  const settings = { showNetherBlobBeamCountdown: true };
  const classes: any = {
    'starling.text.TextField': Label,
    'starling.text.TextFormat': Format,
    'core.scene.SceneBase': { clientSettings: settings },
    'data.DataLocator': {
      getService: () => ({
        loadKey: (table: string, key: string) => {
          assert.equal(table, 'Weapons');
          assert.equal(key, NetherBlobBeamCountdown.weaponKey);
          loads++;
          return { reloadTime: fallback };
        },
      }),
    },
  };
  const api: any = { cls: (name: string) => classes[name] };
  const game: any = {
    time: 1000,
    gameStateMachine: { accumulator: 0 },
    canvasTexts: new Display(),
  };
  const clip = new Display();
  clip.set_x(23);
  clip.set_y(65);
  clip.set_alpha(0.4);
  const ship: any = { alive: true, isAddedToCanvas: true, movieClip: clip, radius: 20 };
  return {
    api,
    classes,
    game,
    ship,
    clip,
    labels,
    settings,
    loads: () => loads,
    setFallback: (value: number) => {
      fallback = value;
    },
  };
}

test('beam estimate follows observed shots and current reload stats, with original fixed bitmap geometry', () => {
  const f = fixture(),
    countdown = new NetherBlobBeamCountdown(f.api);
  const weapon = { key: NetherBlobBeamCountdown.weaponKey, reloadTime: 1000 };
  countdown.draw(f.game, f.ship);
  assert.equal(f.labels.length, 0);
  for (const time of [NaN, Infinity, -1, 0]) countdown.observeShot(weapon, time);
  countdown.observeShot({ ...weapon, key: 'other' }, 1000);
  countdown.draw(f.game, f.ship);
  assert.equal(f.labels.length, 0);
  countdown.observeShot(weapon, 1000);
  countdown.draw(f.game, f.ship);
  const label = f.labels[0];
  assert.equal(label.text, 'Beam ~1.0s');
  assert.deepEqual([label.width, label.height, label.values.pivotX], [180, 24, 90]);
  assert.deepEqual({ ...label.format }, { font: 'DAIDRR_COMBAT', size: 14, color: 0xffcc66 });
  assert.equal(label.values.batchable, true);
  assert.equal(label.get_touchable(), false);
  assert.deepEqual([label.get_x(), label.get_y(), label.get_alpha()], [23, 15, 0.4]);
  assert.equal(f.loads(), 0, 'current runtime stats take priority');
  countdown.draw(f.game, f.ship);
  assert.equal(label.writes, 1, 'unchanged tenth does not rewrite text');
  weapon.reloadTime = 9000;
  countdown.observeShot(weapon, 1000);
  countdown.observeShot(weapon, 999);
  f.game.time = 1880;
  f.game.gameStateMachine.accumulator = 25;
  countdown.draw(f.game, f.ship);
  assert.equal(label.text, 'Beam ~0.1s');
  f.game.time = 3000;
  countdown.draw(f.game, f.ship);
  assert.equal(label.text, 'Beam ready (est.)');
  f.game.time = 20000;
  countdown.draw(f.game, f.ship);
  assert.equal(label.text, 'Beam ready (est.)', 'no invented repeating attack');
  weapon.reloadTime = 500;
  countdown.observeShot(weapon, 20000);
  countdown.draw(f.game, f.ship);
  assert.equal(label.text, 'Beam ~0.5s', 'fresh shot re-reads runtime reload');
  weapon.reloadTime = NaN;
  countdown.observeShot(weapon, 20100);
  countdown.draw(f.game, f.ship);
  assert.equal(label.text, 'Beam ~2.1s');
  assert.equal(f.loads(), 1);
  f.setFallback(3000);
  countdown.observeShot(weapon, 20200);
  countdown.draw(f.game, f.ship);
  assert.equal(label.text, 'Beam ~3.2s');
  assert.equal(f.loads(), 2);
  f.settings.showNetherBlobBeamCountdown = false;
  countdown.draw(f.game, f.ship);
  assert.equal(label.parent, null);
  f.settings.showNetherBlobBeamCountdown = true;
  countdown.draw(f.game, f.ship);
  assert.equal(label.parent, f.game.canvasTexts);
  for (const [target, key, hidden] of [
    [f.ship, 'alive', false],
    [f.ship, 'isAddedToCanvas', false],
  ] as const) {
    target[key] = hidden;
    countdown.draw(f.game, f.ship);
    assert.equal(label.parent, null);
    target[key] = true;
    countdown.draw(f.game, f.ship);
  }
  f.clip.set_visible(false);
  countdown.draw(f.game, f.ship);
  assert.equal(label.parent, null);
  f.clip.set_visible(true);
  f.clip.set_alpha(0);
  countdown.draw(f.game, f.ship);
  assert.equal(label.parent, null);
  f.clip.set_alpha(1);
  countdown.draw(f.game, f.ship);
  assert.equal(label.parent, f.game.canvasTexts);
  f.setFallback(0);
  countdown.observeShot(weapon, 20300);
  countdown.draw(f.game, f.ship);
  assert.equal(label.parent, null, 'invalid reload hides stale estimate');
  countdown.dispose();
  assert.equal(label.disposed, true);
  countdown.draw(f.game, f.ship);
  assert.equal(f.labels.length, 1);
});

test('early native hooks observe before heading catch-up, respect enemy identity, and clean up pooled ships', () => {
  const f = fixture(),
    hooks = new Hooks(),
    cleanups: Function[] = [],
    sessionCleanups: Function[] = [];
  Object.assign(f.api, {
    around: (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'around', fn)),
    before: (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'before', fn)),
    after: (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, 'after', fn)),
  });
  let draws = 0,
    factories = 0;
  class Enemy {
    g = f.game;
    alive = true;
    owner: any = null;
    nether = true;
    isAddedToCanvas = true;
    radius = 20;
    movieClip = f.clip;
    hasFaction(faction: string) {
      assert.equal(faction, 'Nether');
      return this.nether;
    }
    draw() {
      draws++;
      this.movieClip.set_x(77);
      return 'draw';
    }
    removeFromCanvas() {
      this.isAddedToCanvas = false;
    }
    reset() {
      return 'reset';
    }
    destroy() {
      this.alive = false;
    }
  }
  const weapon = { key: NetherBlobBeamCountdown.weaponKey, reloadTime: 1000 };
  const factory = {
    create(_type: any, game: any, owner: any, weapon: any, heading: any) {
      factories++;
      heading.time += 400;
      return 'native projectile';
    },
  };
  class Manager {
    g = f.game;
    addEnemyProjectile(owner: any, time: number) {
      return factory.create(null, this.g, owner, weapon, { time });
    }
  }
  Object.assign(f.classes, {
    'core.ship.EnemyShip': Enemy,
    'core.projectile.ProjectileManager': Manager,
    'core.projectile.ProjectileFactory': factory,
  });
  installNetherBlobBeamHooks(f.api);
  const manager = new Manager(),
    cachedHandler = manager.addEnemyProjectile.bind(manager),
    enemy = new Enemy();
  assert.equal(cachedHandler(enemy, 1000), 'native projectile');
  enemy.draw();
  assert.equal(f.labels.length, 0, 'pre-session capture does not allocate unloaded fonts');
  installNetherBlobBeamCountdown(
    { ...f.api, defer: (fn: Function) => sessionCleanups.push(fn) },
    f.game,
  );
  assert.equal(enemy.draw(), 'draw');
  assert.equal(draws, 2);
  assert.equal(f.labels[0].text, 'Beam ~1.0s', 'captured time precedes native catch-up');
  assert.equal(f.labels[0].get_x(), 77, 'label follows native rendered pose');
  enemy.removeFromCanvas();
  assert.equal(f.labels[0].parent, null);
  enemy.isAddedToCanvas = true;
  enemy.draw();
  assert.equal(f.labels[0].parent, f.game.canvasTexts);
  assert.equal(enemy.reset(), 'reset');
  assert.equal(f.labels[0].disposed, true);
  enemy.draw();
  assert.equal(f.labels.length, 1, 'pooled identity has no old estimate');
  for (const mode of ['owned', 'faction', 'dead', 'wrong-class', 'outside-packet']) {
    enemy.owner = mode === 'owned' ? {} : null;
    enemy.nether = mode !== 'faction';
    enemy.alive = mode !== 'dead';
    if (mode === 'outside-packet') factory.create(null, f.game, enemy, weapon, { time: 2000 });
    else cachedHandler(mode === 'wrong-class' ? {} : enemy, 2000);
    enemy.draw();
    assert.equal(f.labels.length, 1, mode);
  }
  enemy.alive = true;
  enemy.nether = true;
  cachedHandler(enemy, 3000);
  enemy.draw();
  assert.equal(f.labels.length, 2);
  enemy.destroy();
  assert.equal(f.labels[1].disposed, true);
  enemy.alive = true;
  cachedHandler(enemy, 4000);
  enemy.draw();
  assert.equal(f.labels.length, 3);
  sessionCleanups.reverse().forEach((fn) => fn());
  assert.equal(f.labels[2].disposed, true);
  enemy.draw();
  assert.equal(f.labels.length, 3);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(cachedHandler(enemy, 5000), 'native projectile');
  assert.equal(factories, 9);
});
