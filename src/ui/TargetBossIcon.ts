import type { Raw } from '../api/Types';
import type { NativeUI } from './NativeUI';

/** Source target icons force RGB to white while preserving the atlas alpha mask. */
export function createTargetBossIcon(ui: NativeUI, size: number): Raw {
  const icon = ui.image(ui.texture('radar_boss'));
  const scale = size / Math.max(icon.get_width(), icon.get_height());
  icon.set_scaleX(scale);
  icon.set_scaleY(scale);
  icon.set_color(0xffffff);
  const filter = new (ui.cls('starling.filters.ColorMatrixFilter'))();
  // concatValues builds the native Haxe Vector; a JS array is not a Vector.
  filter.concatValues(0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 1, 0);
  icon.set_filter(filter);
  icon.set_touchable(false);
  // Native DisplayObject.dispose owns the attached filter, not the atlas texture.
  return icon;
}
