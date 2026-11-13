import type {} from '../game/InitialWorld';
import type {} from '../game/Clock';
import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { SceneBase, GameScene } from '../game/Bindings';

interface State {
  synchronized: boolean;
  ready: boolean;
  abandoned: boolean;
  progress?: (ready: boolean) => void;
}
const states = new WeakMap<SceneBase, State>();
const replies = new Set([
  'joined',
  'serverTime',
  'initSolarSystem',
  'initPlayer',
  'initEnemyPlayers',
  'initEnemies',
  'initDrops',
  'initServerComplete',
  'initSyncEnemies',
]);
function stateFor(scene: SceneBase): State {
  let state = states.get(scene);
  if (!state) {
    state = { synchronized: false, ready: false, abandoned: false };
    states.set(scene, state);
  }
  return state;
}
export function initialGameIsAbandoned(scene: SceneBase): boolean {
  return states.get(scene)?.abandoned === true;
}
export function initialGameIsReady(scene: GameScene): boolean {
  const state = stateFor(scene);
  state.synchronized ||= scene.synchedEnemies;
  state.ready ||= state.synchronized && scene.clockInitComplete;
  return state.ready;
}
export function observeGameJoinResponse(scene: SceneBase, type: string): void {
  const state = stateFor(scene);
  if (state.ready || state.abandoned || scene.get_isLeaving() || !replies.has(type)) return;
  if (type === 'initSyncEnemies') state.synchronized = true;
  state.ready = state.synchronized && scene.clockInitComplete;
  state.progress?.(state.ready);
}
export function watchInitialGameConnection(
  scene: GameScene,
  progress: (ready: boolean) => void,
): Cleanup {
  const state = stateFor(scene);
  state.progress = progress;
  return () => {
    if (state.progress === progress) state.progress = undefined;
  };
}
export function abandonInitialGameConnection(scene: GameScene): void {
  const state = stateFor(scene);
  if (initialGameIsReady(scene) || state.abandoned || scene.get_isLeaving()) return;
  abandon(scene, state);
}

/** A synchronized socket can still belong to a world that never finished loading. */
export function abandonInitialWorld(scene: GameScene): void {
  const state = stateFor(scene);
  if (scene.get_initialWorldIsRevealed() || state.abandoned || scene.get_isLeaving()) return;
  abandon(scene, state);
}

function abandon(scene: GameScene, state: State): void {
  state.abandoned = true;
  state.progress = undefined;
  scene.clock?.dispose();
  if (scene.connection?.get_connected()) scene.connection.disconnect();
}

/** Reject queued loading work after the manager abandons an unready Game. */
export function installInitialGameConnection(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(SceneBase.prototype, 'onClockReady', function (next, event) {
    if (initialGameIsAbandoned(this) || this.get_isLeaving()) return;
    next(event);
    observeGameJoinResponse(this, 'serverTime');
  });
  reflection.around(GameScene.prototype, 'handleGameDisconnect', function (next) {
    if (!initialGameIsAbandoned(this)) next();
  });
  reflection.around(GameScene.prototype, 'handleServiceDisconnect', function (next) {
    if (!initialGameIsAbandoned(this)) next();
  });
  reflection.around(GameScene.prototype, 'update', function (next, event) {
    if (!initialGameIsAbandoned(this)) next(event);
  });
  reflection.around(GameScene.prototype, 'tickUpdate', function (next) {
    if (!initialGameIsAbandoned(this)) next();
  });
}
