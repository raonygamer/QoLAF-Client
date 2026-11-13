import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { Game } from '../src/game/Game';
import { bindGameClasses } from '../src/game/Bindings';
import { installEnemyObservations } from '../src/ship/EnemyObservations';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('enemy observations respect packed targets, reconstruction and pooled reuse without changing resources', () => {
  const targets = new Map([[17, {}]]);
  class Enemy {
    stateMachine = {
      currentState: null as object | null,
      inState(state: object) {
        return this.currentState !== null && this.currentState.constructor === state;
      },
    };
    alive = true;
    hp = 80;
    shieldHp = 20;
    weapons = [
      {
        firing: false,
        target: null as object | null,
        set_fire(value: boolean) {
          this.firing = value;
        },
      },
    ];
    reset() {}
  }
  const enemy = new Enemy();
  class Manager {
    enemiesById = { h: { 42: enemy } };
    g = { unitManager: { getTarget: (id: number) => targets.get(id) ?? null }, shipManager: this };
    getShipFromId(id: number) {
      return id === 42 ? enemy : null;
    }
    enemyFire(_message: Game.playerio.Message, _start = 0) {}
    damaged() {}
    onEnemyUpdate() {}
    readEnemyEntry(_message: Game.playerio.Message, start: number) {
      return start;
    }
    syncEnemyTarget() {}
  }
  const manager = new Manager();
  class Sync {
    g = manager.g;
    aiCourse() {}
    aiStateChanged(_message: Game.playerio.Message) {}
  }
  class Reconstruct {
    s = enemy;
    enter() {}
    exit() {}
  }
  class Pack {
    handleMessagePack(message: Game.playerio.Message) {
      manager.enemyFire(message, 2);
    }
  }
  const classes: Record<string, object> = {
    'core.ship.EnemyShip': Enemy,
    'core.ship.ShipManager': Manager,
    'core.ship.ShipSync': Sync,
    'core.states.aistates.AIResurect': Reconstruct,
    'core.sync.MessagePackHandler': Pack,
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (owner: object, key: string, callback: Function) => {
    const off = hooks.add(owner, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    after: hook('after'),
    around: hook('around'),
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  // Reconstruction was already entered before the plugin was enabled.
  enemy.stateMachine.currentState = new Reconstruct();
  const observations = installEnemyObservations(api);
  const typedEnemy = enemy as unknown as Game.core.ship.EnemyShip;
  const packet = (values: (number | boolean)[]) =>
    ({
      length: values.length,
      getInt: (index: number) => {
        assert.equal(typeof values[index], 'number');
        return values[index];
      },
      getBoolean: (index: number) => {
        assert.equal(typeof values[index], 'boolean');
        return values[index];
      },
    }) as Game.playerio.Message;
  try {
    assert.equal(observations.isReconstructing(typedEnemy), true);
    assert.equal(
      observations.reconstructionStartedAt(typedEnemy),
      -1,
      'hot enable must not restart an unknown reconstruction timer',
    );
    (enemy.stateMachine.currentState as Reconstruct).exit();
    enemy.stateMachine.currentState = null;
    assert.equal(observations.isReconstructing(typedEnemy), false);
    manager.enemyFire(packet([42, 0, true, 17]));
    assert.equal(observations.isServerTargeting(typedEnemy, 17), true);
    assert.equal(enemy.weapons[0].target, targets.get(17));
    new Pack().handleMessagePack(packet([0, 5, 42, 0, false, 0, 5, 43, 0, true]));
    assert.equal(enemy.weapons[0].firing, false);
    assert.equal(enemy.weapons[0].target, null, 'next record is not a target');
    assert.equal(
      observations.isServerTargeting(typedEnemy, 17),
      true,
      'stop retains sampled aggro',
    );
    for (const state of ['AIFollow', 'AIResurect']) {
      new Sync().aiStateChanged({
        getInt: (offset: number) => {
          assert.equal(offset, 0, 'follow target uses numeric wire encoding');
          return 42;
        },
        getString: () => state,
        getNumber: (offset: number) => {
          assert.equal(offset, 13);
          return 18;
        },
      } as unknown as Game.playerio.Message);
      assert.equal(observations.isServerTargeting(typedEnemy, 18), true);
    }
    const reconstruction = new Reconstruct();
    reconstruction.enter();
    assert.equal(observations.isReconstructing(typedEnemy), true);
    reconstruction.exit();
    assert.equal(observations.isReconstructing(typedEnemy), false);
    assert.equal(observations.hasFreshResources(typedEnemy), true);
    assert.deepEqual([enemy.hp, enemy.shieldHp], [80, 20]);
    enemy.reset();
    assert.equal(observations.hasFreshResources(typedEnemy), false);
    assert.equal(observations.isServerTargeting(typedEnemy, 17), false);
    assert.equal(observations.reconstructionStartedAt(typedEnemy), -1);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal('isReconstructing' in enemy, false);
});
