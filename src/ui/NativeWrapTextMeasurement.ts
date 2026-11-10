import { read, type API, type Raw } from '../api/Types';

/** Native WrapText must measure the same bitmap font that paints its HTML. */
export function installWrapTextMeasurement(api: API): void {
  const wrap = api.cls('core.hud.components.ui.WrapText')?.prototype;
  const TextField = api.cls('starling.text.TextField');
  if (!wrap || !TextField) return;
  const fields = new Map<Raw, Raw>();
  api.around(wrap, 'measure', function (next, width: number) {
    // Keep native plain-text/color extraction initialized for renderedText and
    // renderedColor. Only replace layout metrics when a bitmap font is active.
    const original = next(width);
    const format = read(this.field, 'format');
    if (!TextField.getBitmapFont(read(format, 'font'))) return original;
    let measure = fields.get(this);
    if (!measure) {
      measure = new (TextField as any)(100000, 100000, '', format.clone());
      measure!.set_autoScale(false);
      measure!.set_isHtmlText(true);
      measure!.set_autoSize('vertical');
      fields.set(this, measure!);
    }
    measure!.set_format(format.clone());
    measure!.set_wordWrap(width > 0);
    measure!.set_width(width > 0 ? width : 100000);
    measure!.set_text(read(this.field, 'text', ''));
    const bounds = read(measure, 'textBounds');
    return { width: read(bounds, 'width', 0), height: read(bounds, 'height', 0) };
  });
  api.before(wrap, 'dispose', function () {
    fields.get(this)?.dispose();
    fields.delete(this);
  });
  api.defer(() => {
    for (const field of fields.values()) field.dispose();
    fields.clear();
  });
}
