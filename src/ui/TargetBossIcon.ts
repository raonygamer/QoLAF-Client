import { ColorMatrixFilter, Image, TextureLocator } from '../game/Bindings';

/** Source target icons force RGB to white while preserving the atlas alpha mask. */
export function createTargetBossIcon(size: number): Image {
  const texture = TextureLocator.getService().getTextureGUIByTextureName('radar_boss');
  if (!texture) throw new Error('Missing target boss icon texture: radar_boss');
  const icon = new Image(texture);
  const scale = size / Math.max(icon.get_width(), icon.get_height());
  icon.set_scaleX(scale);
  icon.set_scaleY(scale);
  icon.set_color(0xffffff);
  const filter = new ColorMatrixFilter();
  // concatValues builds the native Haxe Vector; a JS array is not a Vector.
  filter.concatValues(0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 1, 0);
  icon.set_filter(filter);
  icon.set_touchable(false);
  // Native DisplayObject.dispose owns the attached filter, not the atlas texture.
  return icon;
}
