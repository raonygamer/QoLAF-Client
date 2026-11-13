import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceGameIsReady } from '../src/service/ServiceGameReadiness';

test('Haxe readiness uses actual Service socket and initial data and enemy synchronization gates', () => {
  const flags = [
    'initSolarSystemComplete',
    'initPlayerComplete',
    'initEnemyPlayersComplete',
    'initEnemiesComplete',
    'initDropsComplete',
    'initServerComplete',
    'synchedEnemies',
  ] as const;
  const game = {
    get_connected: () => true,
    get_isLeaving: () => false,
    serviceConnection: { get_connected: () => true },
    initSolarSystemComplete: true,
    initPlayerComplete: true,
    initEnemyPlayersComplete: true,
    initEnemiesComplete: true,
    initDropsComplete: true,
    initServerComplete: true,
    synchedEnemies: true,
  };
  assert.equal(serviceGameIsReady(game), true);
  for (const flag of flags) {
    game[flag] = false;
    assert.equal(serviceGameIsReady(game), false, flag);
    assert.equal(serviceGameIsReady(game, false), true);
    game[flag] = true;
  }
  game.serviceConnection.get_connected = () => false;
  assert.equal(serviceGameIsReady(game), false);
  game.serviceConnection.get_connected = () => true;
  game.get_isLeaving = () => true;
  assert.equal(serviceGameIsReady(game), false);
});

test('explicit source readiness and recovery flags remain authoritative when present', () => {
  const game = {
    connected: true,
    serviceConnected: true,
    initialWorldIsRevealed: true,
    isRecoveringGameConnection: false,
  };
  assert.equal(serviceGameIsReady(game), true);
  game.initialWorldIsRevealed = false;
  assert.equal(serviceGameIsReady(game), false);
  game.initialWorldIsRevealed = true;
  game.isRecoveringGameConnection = true;
  assert.equal(serviceGameIsReady(game, false), false);
});
