import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { EliteTechIcon, TechLevelIcon, ToolTip, TweenMax } from '../game/Bindings';

/** Release source-owned tooltips and elite animations before native child disposal. */
export function installTechIconDisposal(api: API): void {
  const reflection = new GameReflection(api);
  reflection.before(EliteTechIcon.prototype, 'dispose', function () {
    if (this.number) TweenMax.killTweensOf(this.number);
    if (this.icon) TweenMax.killTweensOf(this.icon);
  });
  for (const prototype of [EliteTechIcon.prototype, TechLevelIcon.prototype]) {
    reflection.before(prototype, 'dispose', function () {
      // Haxe constructors do not retain the tooltip. Its registry supplies the
      // same ownership link; copy it because dispose unregisters each entry.
      for (const tooltip of [...ToolTip.toolTips]) {
        if (tooltip.target === this) tooltip.dispose();
      }
    });
  }
}
