import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  DailyReward,
  DailyView,
  DataManager,
  Localize,
  MissionView,
  TextFormat,
  ToolTip,
} from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';

/** Original mission fonts and commodity labels, scoped to native screen construction. */
export function installMissionPresentation(api: API): void {
  const reflection = new GameReflection(api);
  let scope: { commodityNames: Set<string> | null } | null = null;
  const fonts = new WeakMap<TextFormat, { original: string; applied: string }>();
  const labels = new WeakMap<ToolTip, { original: string; applied: string }>();
  const formats = new Set<WeakRef<TextFormat>>();
  const tooltips = new Set<WeakRef<ToolTip>>();
  const within = <T>(reward: boolean, draw: () => T): T => {
    const previous = scope;
    scope = { commodityNames: reward ? new Set() : null };
    try {
      return draw();
    } finally {
      scope = previous;
    }
  };
  reflection.around(DailyReward.prototype, 'draw', function (next) {
    return within(true, next);
  });
  for (const method of ['addHeader', 'addDescription', 'addProgress'] as const)
    reflection.around(DailyView.prototype, method, function (next) {
      return within(false, next);
    });
  reflection.around(MissionView.prototype, 'addReward', function (next) {
    return within(false, next);
  });
  const fontName = (name: string, size: number) => {
    if (name === 'font13' || name === 'DAIDRR')
      return RussoBitmapFontRegistry.fontNameForSize(size);
    if (name === 'Verdana') return VerdanaBitmapFontRegistry.fontNameForSize(size);
    return name;
  };
  reflection.around(TextFormat.prototype, 'set_font', function (next, name) {
    if (!scope) return next(name);
    const applied = fontName(name, this.get_size());
    if (applied !== name) {
      if (!fonts.has(this)) formats.add(new WeakRef(this));
      fonts.set(this, { original: name, applied });
    }
    return next(applied);
  });
  reflection.after(TextFormat.prototype, 'clone', function (format) {
    if (scope) format.set_font(format.get_font());
  });
  reflection.after(DataManager.prototype, 'loadKey', function (record, table) {
    if (table !== 'Commodities' || !scope?.commodityNames || !record || typeof record !== 'object')
      return;
    if ('name' in record && typeof record.name === 'string') scope.commodityNames.add(record.name);
  });
  reflection.before(ToolTip.prototype, 'addListeners', function () {
    if (this.type !== 'dailyView' || this.s == null || !scope?.commodityNames?.has(this.s)) return;
    const original = this.s;
    const applied = Localize.t(original);
    if (!labels.has(this)) tooltips.add(new WeakRef(this));
    labels.set(this, { original, applied });
    this.s = applied;
  });
  api.defer(() => {
    for (const reference of formats) {
      const format = reference.deref();
      const value = format && fonts.get(format);
      if (format && value && format.get_font() === value.applied) format.set_font(value.original);
    }
    for (const reference of tooltips) {
      const tooltip = reference.deref();
      const value = tooltip && labels.get(tooltip);
      if (tooltip && value && tooltip.s === value.applied) tooltip.set_text(value.original);
    }
    formats.clear();
    tooltips.clear();
  });
}
