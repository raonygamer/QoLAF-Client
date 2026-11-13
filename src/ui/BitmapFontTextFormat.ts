import { StarlingTextField, type BitmapFont } from '../game/Bindings';
import type {} from '../game/BitmapFont';

/** Font metrics and layout settings; the registry retains ownership of the atlas. */
export class BitmapFontTextFormat {
  font: BitmapFont;
  letterSpacing = 0;
  isKerningEnabled = true;

  constructor(
    font: BitmapFont | string,
    public size = NaN,
    public color = 0xffffff,
    public align = 'left',
    public leading = 0,
  ) {
    const resolved = typeof font === 'string' ? StarlingTextField.getBitmapFont(font) : font;
    if (!resolved) throw Error('Bitmap font is not registered: ' + font);
    this.font = resolved;
  }

  get fontName(): string {
    return this.font.get_name();
  }
}
