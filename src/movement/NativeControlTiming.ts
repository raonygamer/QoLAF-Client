import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayState, type GameScene } from '../game/Bindings';
import type { AutomationGame } from '../game/AutomationGame';
import type { ReplayCommands } from '../game/SelfMovement';
import { takeSteeringTurn } from './SteeringClock';

/** Source PlayState command gates use simulation course time, not render or wall-clock time. */
export function installNativeControlTiming(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const commands: ReplayCommands = game.commandManager;
  const automationGame: AutomationGame = game;
  const boosts = new WeakMap<PlayState, number>();
  const channeling = new WeakMap<PlayState, number>();
  const elapsed = (state: PlayState, times: WeakMap<PlayState, number>): boolean => {
    const course = state.me?.ship?.get_course();
    if (!course) return false;
    const previous = times.get(state);
    if (previous !== undefined && course.time >= previous && course.time - previous < 33)
      return false;
    times.set(state, course.time);
    return true;
  };
  // Install after aim-assist's handleTurn wrapper so both assisted and ordinary
  // steering pass through the same source simulation-tick gate.
  reflection.around(PlayState.prototype, 'handleTurn', function (next, ...args) {
    if (this.g !== game) return next(...args);
    const course = this.me?.ship?.get_course();
    if (course && takeSteeringTurn(this, course.time)) return next(...args);
  });
  reflection.around(PlayState.prototype, 'checkBoost', function (next, ...args) {
    if (this.g !== game) return next(...args);
    if (!this.keybinds.isInputPressed(15) || !elapsed(this, boosts)) return;
    game.commandManager.addBoostCommand();
    const player = this.me;
    if (player?.ship?.get_usingBoost()) game.camera?.zoomFocus(0.75 * player.zoom, 80);
  });
  reflection.before(PlayState.prototype, 'updateCommands', function () {
    if (
      this.g !== game ||
      !this._loaded ||
      !this.me?.get_commandable() ||
      automationGame.automationManager?.controlsClaimed
    )
      return;
    const ship = this.me.ship;
    if (!ship || ship.channelingEnd <= game.time || !elapsed(this, channeling)) return;
    const course = ship.get_course();
    if (!course) return;
    course.rotateLeft = course.rotateRight = course.accelerate = false;
    ship.clearConvergeTarget();
    commands.forceMovementReplayState?.(ship);
  });
}
