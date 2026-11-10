/**
 * Local preview diagnostic. Import manually from the browser's game frame.
 * Exercises native text insertion, changing glyph counts, and disposal without
 * reading account data or changing game settings. Never included in the bundle.
 */
export function runBitmapTextProbe(api, options = {}) {
  const {
    html = true,
    intervalMs = 200,
    durationMs = 45000,
    invalidateParent = false,
  } = options;
  const TextField = api.cls('starling.text.TextField');
  const TextFormat = api.cls('starling.text.TextFormat');
  const field = new TextField(500, 60, '', new TextFormat('DAIDRR', 24, 0xffffff));
  field.get_options().set_isHtmlText(html);
  field.set_x(60);
  field.set_y(320);
  field.set_touchable(false);
  api.game.overlay.addChild(field);

  let counter = 0;
  let disposed = false;
  const update = () => {
    const suffix = html
      ? "<font color='#ff3333'>RED</font> <font color='#33ff33'>GREEN</font>"
      : 'RED GREEN';
    field.set_text(`${html ? 'HTML' : 'Plain'} ${++counter}: ${suffix}`);
    if (invalidateParent) field.get_parent()?.setRequiresRedraw();
  };
  update();
  const updates = setInterval(update, intervalMs);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(updates);
    clearTimeout(expiry);
    field.removeFromParent(true);
  };
  const expiry = setTimeout(dispose, durationMs);
  return { field, dispose };
}
