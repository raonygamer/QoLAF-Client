import { read, type API, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { TargetSystem } from './TargetSystem';

/** Bind native units at their lifetime boundaries, as the source UnitManager does. */
export function installTargetPicking(
  game: Raw,
  session: API,
  ui: NativeUI,
  target: TargetSystem,
): void {
  const bindings = new Map<Raw, { clip: Raw; dispose: () => void }>();
  const manager = game.unitManager;
  const canvas = game.canvas;
  const originalCanvasTouchable = read(canvas, 'touchable');
  canvas.set_touchable(true);

  const unbind = (unit: Raw, clearTarget: boolean) => {
    bindings.get(unit)?.dispose();
    bindings.delete(unit);
    if (clearTarget && target.current === unit) target.clear(true);
  };
  const bind = (unit: Raw) => {
    const clip = read(unit, 'movieClip');
    if (!clip || bindings.get(unit)?.clip === clip) return;
    unbind(unit, false);
    const originalTouchable = read(clip, 'touchable');
    clip.set_touchable(true);
    const removeListener = ui.touch(clip, () => target.select(unit));
    bindings.set(unit, {
      clip,
      dispose() {
        removeListener();
        clip.set_touchable(originalTouchable);
      },
    });
  };

  session.after(manager, 'add', function (_result, unit: Raw) {
    bind(unit);
  });
  // Clear even locked selections before native remove resets/recycles the unit.
  session.before(manager, 'remove', function (unit: Raw) {
    unbind(unit, true);
  });
  const reconcile = () => {
    const units: Raw[] = manager.units;
    const present = new Set(units);
    for (const [unit, binding] of bindings) {
      if (!present.has(unit)) unbind(unit, true);
      else if (read(unit, 'movieClip') !== binding.clip) unbind(unit, false);
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
