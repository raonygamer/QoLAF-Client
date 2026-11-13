import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { DisplayObject, GameScene } from '../game/Bindings';

/** Original InputManager accepts world descendants as well as the bare stage. */
export function isGameplayCanvasTarget(
  target: DisplayObject | null,
  canvas: DisplayObject,
): boolean {
  for (let current = target; current; current = current.get_parent())
    if (current === canvas) return true;
  return false;
}

export function installGameplayPointer(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const input = game.gameStateMachine?.inputManager;
  const canvas = game.canvas;
  if (!input || !canvas) throw new Error('Gameplay pointer requires the active input and canvas');
  reflection.after(input, 'mouseDown', function (_result, event) {
    const target: unknown = event.target;
    if (
      !reflection.is(target, 'starling.display.DisplayObject') ||
      !isGameplayCanvasTarget(target, canvas)
    )
      return;
    this._isMousePressed = true;
    // Retain the newer native control's edge flag, used by click-to-fire.
    this._mouseJustPressed = true;
  });
}
