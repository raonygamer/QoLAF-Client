import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ToolTip, Style } from '../game/Bindings';
import { RussoBitmapFontRegistry } from './RussoBitmapFontRegistry';

const clientStyle = new WeakSet<ToolTip>();

/** Source qolaf_tooltip style, used only by client target/debuff panels. */
export function styleClientTooltip(tooltip: ToolTip): void {
  clientStyle.add(tooltip);
}

/** Hide panels without unregistering their hover targets (source hideType). */
export function hideTooltips(type = 'all'): void {
  for (const tooltip of [...ToolTip.toolTips]) {
    if (type === 'all' || tooltip.type === type) tooltip.hide();
  }
}

/** Source ToolTip.refreshLabel, retaining the newer native WrapText renderer. */
export function installNativeTooltip(api: API): void {
  const reflection = new GameReflection(api);
  const refresh = (tooltip: ToolTip): void => {
    const container = tooltip.container;
    if (!container || !container.get_numChildren()) return;
    const label = container.getChildAt(0);
    if (!reflection.is(label, 'core.hud.components.ui.WrapText')) return;
    label.set_text(tooltip.s);
    label.set_color(tooltip.c !== 0 ? tooltip.c : Style.COLOR_HIGHLIGHT);
    // Newer tooltips can anchor icons to wrapped lines. Keep those anchors and
    // the native background in sync when live text changes the line layout.
    let right = 0;
    let bottom = 0;
    const images = tooltip.imgs ?? [];
    for (let index = 0; index < images.length; index++) {
      const image = images[index]!;
      const data = tooltip.imgsData?.[index];
      if (data) {
        image.set_x(4 + data.x);
        image.set_y(
          4 + (data.line != null ? label.lineTop(data.line) + (data.dy ?? 0) : (data.y ?? 0)),
        );
      }
      right = Math.max(right, image.get_x() + image.get_width());
      bottom = Math.max(bottom, image.get_y() + image.get_height());
    }
    if (images.length) label.growBackground(right + 4, bottom + 4);
  };
  reflection.around(ToolTip.prototype, 'set_text', function (next, text) {
    if (this.s === text) return text;
    const result = next(text);
    if (!text) this.hide();
    else refresh(this);
    return result;
  });
  reflection.after(ToolTip.prototype, 'set_color', function () {
    refresh(this);
  });
  reflection.around(ToolTip.prototype, 'mOver', function (next, event) {
    const previous = this.container;
    next(event);
    if (!clientStyle.has(this) || !this.container || this.container === previous) return;
    const label = this.container.getChildAt(0);
    if (!reflection.is(label, 'core.hud.components.ui.WrapText')) return;
    const format = label.field.get_format();
    format.set_font(RussoBitmapFontRegistry.fontNameForSize(11));
    format.set_size(11);
    format.set_horizontalAlign('left');
    format.set_leading(4);
    refresh(this);
    // Native placement clamps against panel dimensions. Re-run that branch
    // after changing metrics so a newly opened panel stays inside the stage.
    next(event);
  });

  // Source dispose() unregisters itself. Replace the native group loop too:
  // its extra splice would otherwise remove the next, unrelated tooltip.
  reflection.around(ToolTip, 'disposeType', function (_next, type = 'all') {
    for (const tooltip of [...ToolTip.toolTips].reverse()) {
      if (type === 'all' || tooltip.type === type) tooltip.dispose();
    }
  });
  reflection.around(ToolTip.prototype, 'dispose', function (next) {
    if (!this.target) return;
    next();
    const index = ToolTip.toolTips.indexOf(this);
    if (index >= 0) ToolTip.toolTips.splice(index, 1);
  });
  reflection.after(ToolTip, 'disposeAll', function () {
    if (!ToolTip.toolTips.length) ToolTip.g = null;
  });
}
