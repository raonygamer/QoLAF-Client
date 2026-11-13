import { RoamingState } from '../game/Bindings';
import type { Game } from '../game/Game';

/** A hot-enabled state has already registered its pre-hook resize closure. */
export function detachSettingsResizeListeners(state: {
  g: { resizeCallbacks: Array<(...args: never[]) => unknown> };
  hx__closures__?: Record<string, (...args: never[]) => unknown>;
}): void {
  const owned = new Set(Object.values(state.hx__closures__ ?? {}));
  const callbacks = state.g.resizeCallbacks;
  for (let index = callbacks.length - 1; index >= 0; index--)
    if (owned.has(callbacks[index])) callbacks.splice(index, 1);
}

/** Retired menu history may contain a disposed instance of the replacement UI. */
export function closeSettingsForUnload(state: Game.core.states.gameStates.SettingsState): void {
  const game = state.g;
  if (game.get_isLeaving() || game.gameStateMachine?.currentState !== state) return;
  const player = game.get_me();
  if (player?.isLanded && player.currentBody) game.enterLandedState();
  else game.enterState(new RoamingState(game));
}
