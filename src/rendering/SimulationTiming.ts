import type { GameStateMachine, Clock } from '../game/Bindings';
import type { Game } from '../game/Game';

export interface SimulationTimingState
  extends Pick<GameStateMachine, 'newTime' | 'currentTime' | 'frameTime' | 'accumulator'> {
  _clock: Pick<Clock, 'get_elapsedTime'> | null;
  currentState: Pick<Game.core.states.IGameState, 'get_loaded' | 'tickUpdate' | 'execute'> | null;
  previousState: Pick<Game.core.states.IGameState, 'get_unloaded'> | null;
  inputManager: Pick<Game.io.InputManager, 'reset'>;
}

/** Original fixed-step simulation uses local elapsed time, not server corrections. */
export function updateSimulation(machine: SimulationTimingState): void {
  if (!machine._clock) return;
  machine.newTime = machine._clock.get_elapsedTime();
  machine.frameTime = Math.max(0, Math.min(500, machine.newTime - machine.currentTime));
  machine.currentTime = machine.newTime;
  machine.accumulator += machine.frameTime;
  while (machine.accumulator >= 33) {
    machine.currentState?.tickUpdate();
    machine.accumulator -= 33;
  }
  if (
    machine.currentState?.get_loaded() &&
    (!machine.previousState || machine.previousState.get_unloaded())
  ) {
    machine.currentState.execute();
  }
  machine.inputManager.reset();
}

/** Initialization time must not become catch-up simulation on the first frame. */
export function resetSimulationTiming(machine: SimulationTimingState): void {
  machine.accumulator = 0;
  machine.frameTime = 0;
  machine.currentTime = machine._clock?.get_elapsedTime() ?? 0;
  machine.newTime = machine.currentTime;
}
