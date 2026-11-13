import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayState, type GameScene } from '../game/Bindings';
import type { BoostedPlayerShip } from '../game/BoostedPlayerShip';
import type { AutomationGame } from '../game/AutomationGame';

/** Source PlayState throttle axis: one transition per course tick, including forced boost-end boundaries. */
export function installNativeThrottle(
  api: API,
  game: GameScene,
  sendCommand: (type: number, active: boolean, force?: boolean) => boolean,
): void {
  const reflection = new GameReflection(api);
  const automationGame: AutomationGame = game;
  const lastCourseTime = new WeakMap<PlayState, number>();
  reflection.around(PlayState.prototype, 'checkAccelerate', function (next, blocked = false) {
    if (this.g !== game) return next(blocked);
    if (automationGame.automationManager?.controlsClaimed) return next(blocked);
    const player = this.me;
    if (!player?.get_commandable() || !this._loaded) return;
    const ship: BoostedPlayerShip | null = player.ship;
    const course = ship?.get_course();
    if (!ship || !course) return;
    const keys = this.keybinds;
    if (keys.isInputPressed(26)) PlayState.autoCruise = !PlayState.autoCruise;
    if (keys.isInputPressed(11) || keys.isInputPressed(12)) PlayState.autoCruise = false;
    const previous = lastCourseTime.get(this);
    if (previous !== undefined && course.time >= previous && course.time - previous < 33) return;
    lastCourseTime.set(this, course.time);
    if (ship.boostEndedLastTick && ship.isBoostActiveAt?.(course.time)) return;
    const forced = ship.boostEndedLastTick;
    const boosting = ship.get_usingBoost();
    if (
      (!course.accelerate || forced) &&
      ((!blocked && !boosting && keys.isInputDown(11)) || PlayState.autoCruise)
    ) {
      if (sendCommand(0, true, forced)) ship.boostEndedLastTick = false;
      game.camera?.zoomFocus(0.85 * player.zoom, 100);
      return;
    }
    if ((course.accelerate || forced) && !boosting && keys.isInputUp(11) && !PlayState.autoCruise) {
      if (sendCommand(0, false, forced)) ship.boostEndedLastTick = false;
      game.camera?.zoomFocus(player.zoom, 100);
      return;
    }
    if (
      !course.accelerate &&
      !course.deaccelerate &&
      !blocked &&
      !boosting &&
      keys.isInputDown(12)
    ) {
      sendCommand(8, true);
      game.camera?.zoomFocus(player.zoom, 100);
      return;
    }
    if (course.deaccelerate && !boosting && keys.isInputUp(12)) {
      sendCommand(8, false);
      game.camera?.zoomFocus(player.zoom, 100);
    }
  });
}
