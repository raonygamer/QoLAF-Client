import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { GameScene, Unit, TouchEvent } from '../game/Bindings';
import { TargetSystem } from './TargetSystem';

/** Bind native units at their lifetime boundaries, as the source UnitManager does. */
export function installTargetPicking(game: GameScene, session: API, target: TargetSystem): void {
  const reflection = new GameReflection(session);
  const bindings = new Map<
    Unit,
    { clip: NonNullable<ReturnType<Unit['get_movieClip']>>; dispose: () => void }
  >();
  const manager = game.unitManager;
  const canvas = game.canvas;
  if (!canvas) throw new Error('Target picking requires the game canvas.');
  const originalCanvasTouchable = canvas.get_touchable();
  canvas.set_touchable(true);

  const unbind = (unit: Unit, clearTarget: boolean) => {
    bindings.get(unit)?.dispose();
    bindings.delete(unit);
    if (clearTarget) target.remove(unit);
  };
  const bind = (unit: Unit) => {
    const clip = unit.get_movieClip();
    if (!clip || bindings.get(unit)?.clip === clip) return;
    unbind(unit, false);
    const originalTouchable = clip.get_touchable();
    clip.set_touchable(true);
    const onTouch = (event: TouchEvent) => {
      // A texture/clip replacement may happen before the reconciliation pass.
      // The source resolves target.movieClip at event time, not binding time.
      if (unit.get_movieClip() !== clip || !target.valid(unit)) return;
      if (event.getTouch(clip, 'began')) target.select(unit);
    };
    clip.addEventListener('touch', onTouch);
    bindings.set(unit, {
      clip,
      dispose() {
        clip.removeEventListener('touch', onTouch);
        clip.set_touchable(originalTouchable);
      },
    });
  };

  reflection.after(manager, 'add', function (_result, unit: Unit) {
    bind(unit);
  });
  // Clear even locked selections before native remove resets/recycles the unit.
  reflection.before(manager, 'remove', function (unit: Unit) {
    unbind(unit, true);
  });
  const reconcile = () => {
    const units = manager.units;
    const present = new Set(units);
    for (const [unit, binding] of bindings) {
      if (!present.has(unit)) unbind(unit, true);
      else if (unit.get_movieClip() !== binding.clip) unbind(unit, false);
    }
    // Some native units acquire their clip after add; retain that fallback.
    for (const unit of units) bind(unit);
  };
  reconcile();
  session.interval(reconcile, 250);
  session.defer(() => {
    for (const unit of bindings.keys()) unbind(unit, false);
    target.clear(true);
    canvas.set_touchable(originalCanvasTouchable);
  });
}
