import type { API } from '../api/Types';
import { Localize, MissionView, Text } from '../game/Bindings';

/** Apply the source's completed-description formatting before native text measurement. */
export function installMissionDescription(api: API): void {
  api.around(MissionView, 'fixText', function (next, game, definition, text) {
    return next(game, definition, Localize.t(text));
  });
  let scope: MissionView | null = null;
  api.around(MissionView.prototype, 'addDescription', function (next) {
    const previous = scope;
    scope = this;
    try {
      return next();
    } finally {
      scope = previous;
    }
  });
  api.around(Text.prototype, 'set_htmlText', function (next, text) {
    const view = scope;
    if (
      view?.mission.finished &&
      view.missionType.completeDescription != null &&
      !Object.hasOwn(view.missionType, 'nextMission') &&
      text === view.missionType.completeDescription
    ) {
      return next(MissionView.fixText(view.g, view.missionType, text));
    }
    return next(text);
  });
}
