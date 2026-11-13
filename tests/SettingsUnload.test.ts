import assert from 'node:assert/strict';
import test from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import type { Game } from '../src/game/Game';
import { closeSettingsForUnload, detachSettingsResizeListeners } from '../src/settings/SettingsUnload';

test('hot enable removes only resize listeners owned by the rebuilt Settings state', () => {
  const resize = () => {};
  const click = () => {};
  const other = () => {};
  const callbacks = [other, resize, resize];
  const state = { g: { resizeCallbacks: callbacks }, hx__closures__: { resize, click } };
  detachSettingsResizeListeners(state);
  assert.deepEqual(callbacks, [other]);
  detachSettingsResizeListeners(state);
  assert.deepEqual(callbacks, [other]);
  // The new hook receives its own bound closure on re-entry.
  const replacement = () => {};
  callbacks.push(replacement);
  assert.deepEqual(callbacks, [other, replacement]);
});

test('settings unload leaves retired menu history alone and enters a fresh gameplay state', () => {
  class Roaming {
    constructor(readonly game: object) {}
  }
  bindGameClasses({
    cls: (name: string) => (name === 'core.states.gameStates.RoamingState' ? Roaming : {}),
  } as unknown as API);
  const transitions: object[] = [];
  let leaving = false;
  let landed = 0;
  const player = { isLanded: false, currentBody: null as object | null };
  const game = {
    get_isLeaving: () => leaving,
    get_me: () => player,
    gameStateMachine: {
      currentState: null as object | null,
      revertState() {
        throw Error('Disposed history must not be entered');
      },
    },
    enterState: (state: object) => transitions.push(state),
    enterLandedState: () => landed++,
  };
  const state = { g: game } as unknown as Game.core.states.gameStates.SettingsState;
  game.gameStateMachine.currentState = state;
  closeSettingsForUnload(state);
  assert.ok(transitions[0] instanceof Roaming);
  assert.equal(transitions[0].game, game);
  player.isLanded = true;
  player.currentBody = {};
  closeSettingsForUnload(state);
  assert.equal(landed, 1);
  assert.equal(transitions.length, 1);
  leaving = true;
  closeSettingsForUnload(state);
  leaving = false;
  game.gameStateMachine.currentState = {};
  closeSettingsForUnload(state);
  assert.equal(landed, 1);
  assert.equal(transitions.length, 1);
});
