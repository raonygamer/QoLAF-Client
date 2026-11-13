import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Localize, SkinItemBaseStats } from '../game/Bindings';

/** Original SkinItemBaseStats translates labels before native bar construction. */
export function installHangarLabels(api: API): void {
  new GameReflection(api).around(
    SkinItemBaseStats.prototype,
    'addStat',
    function (next, field, label, y) {
      return next(field, Localize.t(label), y);
    },
  );
}
