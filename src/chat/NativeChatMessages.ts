import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** Project received messages with the original rich bitmap renderer. */
export function installNativeChatMessages(
  api: API,
  game: Raw,
  resolve: Resolve,
  preferences?: DeviceSettings,
): void {
  const log = game.messageLog;
  const WrapText = api.cls('core.hud.components.ui.WrapText');
  if (!log?.simple?.tf || !log.advanced?.scroll || !WrapText) return;
  const Renderer = resolve('core.hud.components.chat.rich.RichBitmapFontTextRenderer');
  const BitmapFormat = resolve('feathers.text.BitmapFontTextFormat');
  const rows = new Map<Raw, { renderer: Raw; field: Raw; alpha: number; index: number }>();
  const font = () =>
    new BitmapFormat('verdana48_bitmap', preferences?.get('legacyChatFontSize') ?? 14, 0xffffff);
  const project = (row: Raw) => {
    const entry = rows.get(row)!;
    entry.renderer.text = read(entry.field, 'text', '');
    entry.renderer.maxWidth = row.maxWidth > 0 ? row.maxWidth : Infinity;
    entry.renderer.set_width(row.hasWidth ? row.viewWidth : NaN);
    entry.renderer.validate();
    row.measuredWidth = entry.renderer.get_width();
    row.measuredHeight = entry.renderer.get_height();
  };
  const bind = (row: Raw) => {
    if (!row?.field || rows.has(row)) return;
    const renderer = new Renderer();
    renderer.textFormat = font();
    renderer.wordWrap = true;
    renderer.truncateToFit = false;
    renderer.useSeparateBatch = false;
    renderer.textureSmoothing = 'bilinear';
    renderer.pixelSnapping = row !== log.simple.tf;
    renderer.emojiScale = 1;
    renderer.animateClientDeveloperTags = true;
    renderer.animateEchoLabels = true;
    renderer.animateRoomInvites = true;
    renderer.animatePodRewards = true;
    renderer.measureWrappedWidthAtConstraint = row !== log.simple.tf;
    renderer.set_touchable(false);
    const field = row.field;
    const index = row.getChildIndex(field);
    rows.set(row, { renderer, field, index, alpha: read(row, 'alpha') });
    row.removeChild(field);
    row.addChildAt(renderer, Math.max(0, index));
    row.set_alpha(1);
    project(row);
  };
  api.around(WrapText.prototype, 'layoutText', function (next, ...args) {
    if (rows.has(this)) return project(this);
    return next(...args);
  });
  api.around(WrapText.prototype, 'get_width', function (next, ...args) {
    const entry = rows.get(this);
    return entry ? entry.renderer.get_width() : next(...args);
  });
  api.around(WrapText.prototype, 'dispose', function (next, ...args) {
    const entry = rows.get(this);
    if (entry) {
      rows.delete(this);
      // The detached upstream field still belongs to this row.
      entry.field.dispose();
    }
    return next(...args);
  });
  const scroll = log.advanced.scroll;
  const bindAdvanced = () => {
    for (let index = 0; index < read(scroll, 'numChildren'); index++)
      bind(scroll.getChildAt(index));
    scroll.arrange();
  };
  api.after(log.advanced, 'addText', bindAdvanced);
  bind(log.simple.tf);
  bindAdvanced();
  if (preferences)
    api.defer(
      preferences.subscribe((key) => {
        if (key !== 'legacyChatFontSize') return;
        const position = read(scroll, 'verticalScrollPosition');
        const followBottom = position >= read(scroll, 'maxVerticalScrollPosition') - 2;
        for (const [row, entry] of rows) {
          entry.renderer.textFormat = font();
          project(row);
        }
        // Also run Simple's viewport positioning hook after font reflow.
        log.simple.tf.set_text(read(log.simple.tf, 'text', ''));
        scroll.arrange();
        scroll.scrollToPosition(
          0,
          followBottom ? read(scroll, 'maxVerticalScrollPosition') : position,
        );
      }),
    );
  api.defer(() => {
    for (const [row, entry] of rows) {
      rows.delete(row);
      entry.renderer.removeFromParent(true);
      row.addChildAt(entry.field, Math.max(0, entry.index));
      row.set_alpha(entry.alpha);
      row.layoutText();
    }
    scroll.arrange();
  });
}
