import { StarlingTextField } from '../game/Bindings';
import type { Game } from '../game/Game';

/** Original atlas aliases and size selection; assets are installed by loadFonts. */
export class VerdanaBitmapFontRegistry {
  static readonly PRIMARY_FONT_NAME = 'verdana48_bitmap';
  static readonly UI_24_FONT_NAME = 'verdana24_bitmap';
  static readonly LEGACY_FONT_ALIAS = 'Verdana';
  static fontNameForSize(size: number): string {
    if (!(size > 0)) return this.PRIMARY_FONT_NAME;
    for (const atlasSize of [8, 16, 24, 32])
      if (size <= atlasSize) return 'verdana' + atlasSize + '_bitmap';
    return this.PRIMARY_FONT_NAME;
  }
  static registerLoadedFont(): Game.starling.text.BitmapFont {
    const font = StarlingTextField.getBitmapFont(this.PRIMARY_FONT_NAME);
    if (!font) throw Error('Load the original Verdana font atlases before creating text');
    return font;
  }
}
