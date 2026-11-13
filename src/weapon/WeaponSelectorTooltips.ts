import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ToolTip, WeaponSelector, type DisplayObject } from '../game/Bindings';

/** Original WeaponSelector.clearIcons: tooltip ownership ends before icon disposal. */
export function installWeaponSelectorTooltips(api: API): void {
  const reflection = new GameReflection(api);
  const originalTypes = new Map<ToolTip, string>();
  const clear = (selector: WeaponSelector) => {
    const icons = new Set<DisplayObject>(selector.icons ?? []);
    // Also handles selectors constructed before the plugin was enabled.
    for (const tooltip of [...ToolTip.toolTips]) {
      if (!tooltip.target || !icons.has(tooltip.target)) continue;
      originalTypes.delete(tooltip);
      tooltip.dispose();
    }
  };
  reflection.after(WeaponSelector.prototype, 'addWeaponSelectIcon', function () {
    const icon = this.icons?.at(-1);
    if (!icon) return;
    for (const tooltip of ToolTip.toolTips) {
      if (tooltip.target !== icon) continue;
      if (!originalTypes.has(tooltip)) originalTypes.set(tooltip, tooltip.type);
      tooltip.type = 'WeaponSelector';
    }
  });
  reflection.before(WeaponSelector.prototype, 'refresh', function () {
    clear(this);
  });
  reflection.before(WeaponSelector.prototype, 'dispose', function () {
    clear(this);
  });
  reflection.after(ToolTip.prototype, 'dispose', function () {
    originalTypes.delete(this);
  });
  api.defer(() => {
    // Existing icons retain hover behavior when returning to the vanilla loader.
    for (const [tooltip, type] of originalTypes)
      if (ToolTip.toolTips.includes(tooltip)) tooltip.type = type;
    originalTypes.clear();
  });
}
