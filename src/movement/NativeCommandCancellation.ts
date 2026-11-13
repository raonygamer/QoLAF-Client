import { GameScene, PlayState } from '../game/Bindings';
import { cancelWeaponFire } from '../weapon/WeaponCancellation';

interface AimPlayState extends PlayState {
  releaseAimAssist?(): void;
}

/** Source PlayState.cancelAllCommands, through the current Haxe sendCommand path. */
export function cancelNativePlayerCommands(game: unknown): void {
  if (!GameScene || !(game instanceof GameScene)) return;
  const active = game.gameStateMachine?.currentState;
  if (!(active instanceof PlayState)) return;
  const play: AimPlayState = active;
  PlayState.autoCruise = false;
  play.fireWithHotkeys = false;
  play.releaseAimAssist?.();
  const ship = play.me?.ship;
  if (!ship) return;
  const course = ship.get_course();
  if (course) {
    for (const [field, command] of [
      ['accelerate', 0],
      ['deaccelerate', 8],
      ['rotateLeft', 1],
      ['rotateRight', 2],
    ] as const)
      if (course[field]) play.sendCommand(command, false);
  }
  if (ship.get_isShooting()) {
    for (const weapon of ship.weapons) cancelWeaponFire(weapon);
    play.sendCommand(3, false);
  }
  const player = game.get_me();
  if (player) game.camera?.zoomFocus(player.zoom, 100);
}
