import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installShipCreation } from '../src/ship/ShipCreation';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('player owner is bound before body and name callbacks on new and reused ships', () => {
  const observed: string[] = [];
  type Player = { id: string };
  class Ship {
    player: Player | null = null;
    createBody() {
      observed.push(`body:${this.player?.id}`);
    }
    set_name() {
      observed.push(`name:${this.player?.id}`);
    }
  }
  const weapons: object[] = [];
  const game = {};
  const factory = {
    // Native build564 ordering: createBody, set_name, then assign player.
    createPlayer(scene: object, player: Player, ship: Ship, equipment: object[]) {
      assert.equal(scene, game);
      assert.equal(equipment, weapons);
      ship.createBody();
      ship.set_name();
      ship.player = player;
      return ship;
    },
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.ship.ShipFactory' ? factory : {}),
    before: (target: object, key: string, callback: Function) => {
      const cleanup = hooks.add(target, key, 'before', callback);
      cleanups.push(cleanup);
      return cleanup;
    },
  } as unknown as API;
  bindGameClasses(api);
  installShipCreation(api);
  const ship = new Ship();
  try {
    assert.equal(factory.createPlayer(game, { id: 'first' }, ship, weapons), ship);
    assert.equal(factory.createPlayer(game, { id: 'second' }, ship, weapons), ship);
    assert.deepEqual(observed, ['body:first', 'name:first', 'body:second', 'name:second']);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  observed.length = 0;
  factory.createPlayer(game, { id: 'third' }, ship, weapons);
  assert.deepEqual(observed, ['body:second', 'name:second'], 'unload restores native ordering');
});
