import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { StartSetup, Localize } from '../game/Bindings';

/** Original changeSkin translations without mutating shared skin metadata or animation IDs. */
export function installShipSelectionText(api: API): void {
  const reflection = new GameReflection(api);
  let selecting: StartSetup | null = null;
  reflection.around(StartSetup.prototype, 'changeSkin', function (next, skin, button) {
    const previous = selecting;
    selecting = this;
    try {
      const result = next(skin, button);
      const description = this.description;
      if (description) {
        description.set_text(Localize.t(description.get_text()));
        description.set_pivotX(description.get_width() / 2);
      }
      return result;
    } finally {
      selecting = previous;
    }
  });
  reflection.around(StartSetup.prototype, 'addAnimatedText', function (next, text, ...args) {
    return next(selecting === this ? Localize.t(text) : text, ...args);
  });
}
