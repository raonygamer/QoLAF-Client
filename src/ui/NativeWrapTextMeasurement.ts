import { bitmapLineTops } from '../ported/RichBitmapFontCompositor';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { WrapText, StarlingTextField } from '../game/Bindings';

/** Native WrapText must measure the same bitmap font that paints its HTML. */
export function installWrapTextMeasurement(api: API): void {
  const reflection = new GameReflection(api);
  const fields = new Map<WrapText, StarlingTextField>();
  reflection.around(WrapText.prototype, 'measure', function (next, width) {
    // Keep native plain-text/color extraction initialized for renderedText and
    // renderedColor. Only replace layout metrics when a bitmap font is active.
    const original = next(width);
    const format = this.field.get_format();
    if (!StarlingTextField.getBitmapFont(format.get_font())) return original;
    let measure = fields.get(this);
    if (!measure) {
      measure = new StarlingTextField(100000, 100000, '', format.clone());
      measure.set_autoScale(false);
      measure.set_isHtmlText(true);
      measure.set_autoSize('vertical');
      fields.set(this, measure);
    }
    measure.set_format(format.clone());
    measure.set_wordWrap(width > 0);
    measure.set_width(width > 0 ? width : 100000);
    measure.set_text(this.field.get_text());
    const bounds = measure.get_textBounds();
    return { width: bounds.width, height: bounds.height };
  });
  reflection.around(WrapText.prototype, 'lineTop', function (next, line) {
    if (!StarlingTextField.getBitmapFont(this.field.get_format().get_font())) {
      return next(line);
    }
    this.measure(this.lastWrapWidth);
    const batch = fields.get(this)?._meshBatch;
    const top = batch ? bitmapLineTops.get(batch)?.[line] : undefined;
    return top ?? next(line);
  });
  reflection.before(WrapText.prototype, 'dispose', function () {
    fields.get(this)?.dispose();
    fields.delete(this);
  });
  api.defer(() => {
    for (const field of fields.values()) field.dispose();
    fields.clear();
  });
}
