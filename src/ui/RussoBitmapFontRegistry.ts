import { StarlingTextField } from '../game/Bindings';
import type { Game } from '../game/Game';

/** Original atlas aliases and size selection; assets are installed by loadFonts. */
export class RussoBitmapFontRegistry {
  static readonly PRIMARY_FONT_NAME = 'DAIDRR';
  static readonly COMBAT_FONT_NAME = 'DAIDRR_COMBAT';
  static readonly DEVICE_FONT_ALIAS = '_sans';
  static readonly UI_24_FONT_NAME = 'DAIDRR_24';
  static fontNameForSize(size: number): string {
    if (!(size > 0) || size > 56) return this.PRIMARY_FONT_NAME;
    for (const atlasSize of [8, 16, 24, 32, 48])
      if (size <= atlasSize) return 'DAIDRR_' + atlasSize;
    return this.PRIMARY_FONT_NAME;
  }
  static register(): Game.starling.text.BitmapFont {
    const font = StarlingTextField.getBitmapFont(this.PRIMARY_FONT_NAME);
    if (!font) throw Error('Load the original Russo font atlases before creating text');
    return font;
  }
}
