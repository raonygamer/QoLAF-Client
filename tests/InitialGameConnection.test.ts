import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameScene } from '../src/game/Bindings';
import {
  abandonInitialGameConnection,
  abandonInitialWorld,
  initialGameIsAbandoned,
  initialGameIsReady,
  observeGameJoinResponse,
  watchInitialGameConnection,
} from '../src/network/InitialGameConnection';

function scene() {
  const state = {
    synchedEnemies: false,
    clockInitComplete: false,
    leaving: false,
    revealed: false,
    connected: true,
    clockDisposals: 0,
    disconnects: 0,
    get_isLeaving() {
      return this.leaving;
    },
    get_initialWorldIsRevealed() {
      return this.revealed;
    },
    clock: {
      dispose() {
        state.clockDisposals++;
      },
    },
    connection: {
      get_connected() {
        return state.connected;
      },
      disconnect() {
        state.disconnects++;
        state.connected = false;
      },
    },
  };
  return { state, game: state as unknown as GameScene };
}

test('initial join requires both enemy synchronization and clock readiness in either order', () => {
  for (const clockFirst of [true, false]) {
    const { state, game } = scene();
    const progress: boolean[] = [];
    const stop = watchInitialGameConnection(game, (ready) => progress.push(ready));
    observeGameJoinResponse(game, 'chatMsg');
    assert.deepEqual(progress, [], 'unrelated traffic cannot keep a loading watchdog alive');
    observeGameJoinResponse(game, 'initPlayer');
    assert.deepEqual(progress, [false]);
    if (clockFirst) {
      state.clockInitComplete = true;
      observeGameJoinResponse(game, 'serverTime');
    } else observeGameJoinResponse(game, 'initSyncEnemies');
    assert.equal(initialGameIsReady(game), false);
    assert.deepEqual(progress, [false, false]);
    if (clockFirst) observeGameJoinResponse(game, 'initSyncEnemies');
    else {
      state.clockInitComplete = true;
      observeGameJoinResponse(game, 'serverTime');
    }
    assert.equal(initialGameIsReady(game), true);
    assert.deepEqual(progress, [false, false, true]);
    observeGameJoinResponse(game, 'initDrops');
    assert.equal(progress.length, 3, 'ready scenes stop notifying the loading watchdog');
    stop();
  }
});

test('late queued responses cannot revive an abandoned initial connection', () => {
  const { state, game } = scene();
  const progress: boolean[] = [];
  watchInitialGameConnection(game, (ready) => progress.push(ready));
  observeGameJoinResponse(game, 'initPlayer');
  abandonInitialGameConnection(game);
  assert.equal(initialGameIsAbandoned(game), true);
  assert.equal(state.clockDisposals, 1);
  assert.equal(state.disconnects, 1);
  state.clockInitComplete = true;
  observeGameJoinResponse(game, 'serverTime');
  observeGameJoinResponse(game, 'initSyncEnemies');
  assert.deepEqual(progress, [false]);
  abandonInitialGameConnection(game);
  abandonInitialWorld(game);
  assert.equal(state.clockDisposals, 1);
  assert.equal(state.disconnects, 1);
});

test('network completion does not exempt a stalled world from its separate loading deadline', () => {
  const { state, game } = scene();
  state.synchedEnemies = true;
  state.clockInitComplete = true;
  assert.equal(initialGameIsReady(game), true, 'adopts a game initialized before hook activation');
  abandonInitialGameConnection(game);
  assert.equal(state.disconnects, 0, 'network timeout cannot discard a synchronized game');
  abandonInitialWorld(game);
  assert.equal(state.disconnects, 1, 'world loading can still time out before reveal');
  assert.equal(initialGameIsAbandoned(game), true);
  for (const mode of ['revealed', 'leaving'] as const) {
    const other = scene();
    other.state[mode] = true;
    abandonInitialWorld(other.game);
    assert.equal(other.state.disconnects, 0);
  }
});

test('replacing an initialization watcher isolates cleanup and scene ownership', () => {
  const first = scene(),
    second = scene();
  const calls: string[] = [];
  const oldStop = watchInitialGameConnection(first.game, () => calls.push('old'));
  const newStop = watchInitialGameConnection(first.game, () => calls.push('new'));
  watchInitialGameConnection(second.game, () => calls.push('other'));
  oldStop();
  observeGameJoinResponse(first.game, 'joined');
  observeGameJoinResponse(second.game, 'joined');
  assert.deepEqual(calls, ['new', 'other']);
  newStop();
  observeGameJoinResponse(first.game, 'initPlayer');
  second.state.leaving = true;
  observeGameJoinResponse(second.game, 'initPlayer');
  assert.deepEqual(calls, ['new', 'other']);
});
