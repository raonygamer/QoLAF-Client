import type { API } from '../api/Types';
import {
  ArtifactBox,
  ArtifactCargoBox,
  ArtifactSelector,
  PopupMessage,
  PopupBuyMessage,
  Localize,
  ToolTip,
} from '../game/Bindings';

/** Translate the original slot/reveal prompts while retaining native tooltip rendering. */
export function installArtifactPrompts(api: API): void {
  api.around(
    ArtifactSelector.prototype,
    'createArtifactIcon',
    function (next, index, texture, type, locked, inUse, enabled, tooltip) {
      if (tooltip != null) {
        const prefix = "<FONT COLOR='#2233ff'>";
        const suffix = '</FONT>: Click to change active artifacts';
        if (tooltip.startsWith(prefix) && tooltip.endsWith(suffix)) {
          const name = tooltip.slice(prefix.length, -suffix.length);
          tooltip = Localize.t(prefix + '[name]' + suffix).replace('[name]', Localize.t(name));
        } else if (
          [
            'Empty: Click to assign an artifact',
            'Locked artifact slot, click to buy this slot',
            'Locked artifact slot',
          ].includes(tooltip)
        ) {
          tooltip = Localize.t(tooltip);
        }
      }
      return next(index, texture, type, locked, inUse, enabled, tooltip);
    },
  );
  api.around(PopupMessage.prototype, 'set_text', function (next, text) {
    return next(text === 'Artifact Slot' ? Localize.t(text) : text);
  });
  api.around(
    PopupBuyMessage.prototype,
    'addBuyForFluxButton',
    function (next, cost, slot, message, confirmation) {
      if (message === 'buyArtifactSlotWithFlux') confirmation = Localize.t(confirmation);
      return next(cost, slot, message, confirmation);
    },
  );
  api.around(ToolTip.prototype, 'set_text', function (next, text) {
    if (
      (this.target instanceof ArtifactBox || this.target instanceof ArtifactCargoBox) &&
      (text === 'Locked slot, click to buy.' || text === 'Click to reveal!')
    )
      return next(Localize.t(text));
    return next(text);
  });
}
