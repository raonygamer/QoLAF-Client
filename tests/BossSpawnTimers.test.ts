import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BossSpawnTimerCatalog } from '../src/Boss/BossSpawnTimerCatalog';
import { BossSpawnTimers } from '../src/Boss/BossSpawnTimers';
import { installBossSpawnTimerHooks, bossSpawnTimers } from '../src/Boss/NativeBossSpawnTimers';
import type { Raw } from '../src/Api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './Fixtures/HostCore.js';

function fixture() {
  let local = 1000;
  const spawner = { key: 'station', hidden: true, obj: { enemy: 'mini', resetTime: 2 } };
  const body = { obj: { boss: 'boss', spawnTime: 5 }, spawners: [spawner] };
  const tables = {
    Bosses: { boss: { name: 'Three Emperors' } },
    Enemies: { mini: { name: 'Mini lvl 90', miniBoss: true } },
  };
  const game: Raw = {
    gameStartedTime: 1,
    get_isLeaving: () => false,
    get_connected: () => true,
    clock: { getServerTime: () => 600001 },
    bodyManager: { bodies: [body] },
    dataManager: { loadTable: (name: keyof typeof tables) => tables[name] },
    bossManager: { bosses: [] },
    shipManager: { enemies: [] },
    isSystemTypeSurvival: () => false,
  };
  const model = new BossSpawnTimers(
    game,
    (enemy) => enemy.identity,
    () => local,
  );
  const at = (serverTime: number) => {
    local += 250;
    game.clock.getServerTime = () => serverTime;
  };
  return { game, model, at, body, spawner, tables };
}

test('catalog preserves zero, gating, probability, secondary slots, and ordinary special spawners', () => {
  const { body, spawner, tables } = fixture();
  const make = () => BossSpawnTimerCatalog.build([body], tables.Bosses, tables.Enemies);
  assert.equal(make()[0].sources[0].periodMs, 300000);
  body.obj.spawnTime = 0;
  assert.equal(make()[0].sources[0].periodMs, 0);
  const data = spawner.obj as Raw;
  data.bossSpawner = true;
  assert.equal(make()[1].sources[0].periodMs, 120000);
  data.enemies = [{ key: 'mini', probability: 0 }];
  assert.equal(make().length, 1);
  data.enemies = ['mini', 'other'];
  assert.equal(make()[1].sources[0].periodMs, 0);
  data.enemies = Array(513).fill('mini');
  assert.equal(make()[1].sources[0].periodMs, 0);
  data.enemies = ['mini'];
  data.maxActiveEnemies = 0;
  assert.equal(make().length, 1);
  data.hasSecondSpawn = true;
  data.enemy2 = 'mini';
  data.resetTime2 = 3;
  assert.equal(make()[1].sources[0].periodMs, 180000);
  data.triggeredByMission = true;
  assert.equal(make()[1].conditional, true);
  assert.equal(make()[1].sources[0].periodMs, 0);
  (spawner as Raw).isBossUnit = true;
  assert.equal(make().length, 1);
});

test('boss global window grace and confirmed kill minimum use scheduled boundaries', () => {
  const { model, at } = fixture();
  assert.match(model.rows(false)[0].text, /expected now/);
  at(601500);
  assert.match(model.rows(false)[0].text, /expected now/);
  at(601501);
  assert.match(model.rows(false)[0].text, /4 mins, 59 seconds/);
  at(841000);
  model.recordDeath('boss', 'boss', '', null);
  at(900001);
  assert.match(model.rows(false)[0].text, /5 mins, 0 seconds/);
});

test('minibosses require real source-specific kills, ignore duplicates, and never wrap overdue timers', () => {
  const { model, at, game, spawner } = fixture();
  assert.match(model.rows(true)[1].text, /unknown/);
  model.recordDeath('enemy', 'mini', 'wrong', 1);
  assert.match(model.rows(true)[1].text, /unknown/);
  model.recordDeath('enemy', 'mini', 'station', 1);
  assert.match(model.rows(true)[1].text, /2 mins, 0 seconds/);
  at(660001);
  model.recordDeath('enemy', 'mini', 'station', 1);
  assert.match(model.rows(true)[1].text, /1 min, 0 seconds/);
  at(900001);
  assert.match(model.rows(true)[1].text, /expected now/);
  game.shipManager.enemies = [{ alive: true, identity: { definitionKey: 'mini' } }];
  at(901001);
  assert.equal(model.rows(true)[1].text, 'Mini is alive.');
  game.shipManager.enemies[0].rareType = 6;
  at(902001);
  assert.match(model.rows(true)[1].text, /expected now/);
  (spawner as Raw).hidden = false;
  (spawner as Raw).alive = false;
  at(903001);
  assert.match(model.rows(true)[1].text, /unknown/);
});

test('unknown clock, seasonal visibility, delayed initialization, and survival do not promise timers', () => {
  const { model, game, at, body } = fixture();
  game.gameStartedTime = 0;
  assert.deepEqual(model.rows(true), []);
  (body.obj as Raw).event = 'season';
  game.gameStartedTime = 1;
  assert.deepEqual(model.rows(true), []);
  game.bossManager.bosses = [{ alive: true, key: 'boss', get_name: () => 'Three Emperors' }];
  at(700000);
  assert.equal(model.rows(false)[0].text, 'Three Emperors are alive.');
  game.bossManager.bosses = [];
  at(701000);
  assert.match(model.rows(false)[0].text, /unknown/);
  at(NaN);
  assert.match(model.rows(false)[0].text, /waiting for server clock/);
  game.get_isLeaving = () => true;
  assert.deepEqual(model.rows(true), []);
  model.dispose();
  assert.deepEqual(model.rows(true), []);
  const other = fixture();
  other.game.isSystemTypeSurvival = () => true;
  assert.match(other.model.rows(false)[0].text, /unknown/);
});

test('native hooks retain non-orbit spawner keys before pooling and leave handlers/results intact', () => {
  const { game } = fixture();
  let calls = 0;
  class ObjectBase {
    reset() {}
  }
  class Enemy extends ObjectBase {
    alive = true;
    rareType = 0;
    get_id() {
      return 42;
    }
    destroy() {
      this.alive = false;
      this.reset();
    }
  }
  const enemy = new Enemy();
  const factory = {
    createEnemy(_game: Raw, _key: string) {
      return enemy;
    },
  };
  class Spawners {
    g = game;
    getSpawnerByKey(_key: string) {
      return null;
    }
  }
  const spawners = new Spawners();
  class Manager {
    g = game;
    enemiesById = { h: { '42': enemy } };
    spawnEnemy() {
      spawners.getSpawnerByKey('station');
      factory.createEnemy(game, 'mini');
      this.createSetEnemy(enemy, 42, null, 1, 0, null);
      return 123;
    }
    createSetEnemy(..._args: unknown[]) {}
    killed(message: Raw, start: number) {
      calls++;
      assert.equal(message.getInt(start), 42);
      enemy.destroy();
      return 456;
    }
  }
  class BossManager {
    bosses: Raw[] = [];
    g = game;
    killBoss(_boss: Raw) {}
  }
  const classes: Raw = {
    'core.ship.ShipManager': Manager,
    'core.ship.ShipFactory': factory,
    'core.spawner.SpawnManager': Spawners,
    'core.boss.BossManager': BossManager,
    'core.GameObject': ObjectBase,
  };
  const hooks = new Hooks(),
    cleanups: (() => void)[] = [];
  installBossSpawnTimerHooks({
    cls: (key: string) => classes[key],
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    after: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
    onGame: (fn: Function) => fn(game, { defer: (fn: () => void) => cleanups.push(fn) }),
  } as any);
  const manager = new Manager();
  const cachedHandler = manager.killed.bind(manager);
  assert.equal(manager.spawnEnemy(), 123);
  assert.equal(cachedHandler({ getInt: () => 42 }, 0), 456);
  assert.equal(calls, 1);
  assert.match(bossSpawnTimers(game).rows(true)[1].text, /2 mins, 0 seconds/);
  assert.equal(enemy.alive, false);
  cleanups.forEach((fn) => fn());
});

test('ambiguous missing sources and unsynchronized deaths stay unknown; seasonal sources cannot win', () => {
  const { body, spawner, tables, game, model, at } = fixture();
  const second = { ...spawner, key: 'other' };
  body.spawners.push(second);
  model.recordDeath('enemy', 'mini', '', 1);
  assert.match(model.rows(true)[1].text, /unknown/);
  at(NaN);
  model.recordDeath('enemy', 'mini', 'station', 2);
  model.recordDeath('boss', 'boss', '', null);
  at(700000);
  assert.match(model.rows(true)[0].text, /unknown/);
  assert.match(model.rows(true)[1].text, /unknown/);
  const seasonalBody = { obj: { boss: 'boss', spawnTime: 1, event: 'season' }, spawners: [] };
  const rows = BossSpawnTimerCatalog.build([body, seasonalBody], tables.Bosses, tables.Enemies);
  assert.equal(rows[0].conditional, false);
  assert.deepEqual(
    rows[0].sources.map((source) => source.periodMs),
    [300000, 0],
  );
  game.bossManager.bosses = [{ key: 'uncached', alive: true, get_name: () => 'Uncached' }];
  at(701000);
  assert.equal(model.rows(false).at(-1)?.text, 'Uncached is alive.');
});
