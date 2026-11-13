import type { API } from '../api/Types';
import { StarlingStage, Starling, Login } from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** RymdenRunt.resize's logical stage dimensions, keeping the physical viewport intact. */
export function scaledStageSize(physicalSize: number, scale: number): number {
  const physicalEven = physicalSize - (physicalSize % 2);
  const logical = Math.max(2, Math.trunc(physicalEven / scale));
  return logical - (logical % 2);
}

export function installDisplayScale(api: API, preferences: DeviceSettings): void {
  const prototype = StarlingStage.prototype;
  if (!prototype?.set_stageWidth || !prototype?.set_stageHeight) return;
  const current = () => Starling.get_current();
  let disposed = false;

  const apply = () => {
    const starling = current();
    const stage = starling?.get_stage();
    const native = starling?.get_nativeStage();
    const width = native?.stageWidth ?? 0;
    const height = native?.stageHeight ?? 0;
    if (!stage || !width || !height || disposed) return;
    stage.set_stageWidth(width);
    stage.set_stageHeight(height);
    // The existing RymdenRunt resize listener keeps the physical viewport current;
    // existing game/login listeners lay out their controls in logical coordinates.
    stage.dispatchEventWith('resize');
  };

  // Register restoration before hooks so the host removes those hooks first.
  api.defer(() => {
    disposed = true;
    const starling = current();
    const stage = starling?.get_stage();
    const native = starling?.get_nativeStage();
    if (!stage || !native) return;
    stage.set_stageWidth(scaledStageSize(native.stageWidth, 1));
    stage.set_stageHeight(scaledStageSize(native.stageHeight, 1));
    stage.dispatchEventWith('resize');
  });
  for (const name of ['set_stageWidth', 'set_stageHeight'] as const) {
    api.around(prototype, name, function (next, value: number) {
      if (this !== current()?.get_stage()) return next(value);
      return next(scaledStageSize(value, preferences.get('dpiScale')));
    });
  }
  api.defer(
    preferences.subscribe((key) => {
      if (key === 'dpiScale') apply();
    }),
  );
  const login = Login.prototype;
  if (typeof login?.init === 'function') api.after(login, 'init', apply);
  api.onGame(() => apply());
  apply();
}
