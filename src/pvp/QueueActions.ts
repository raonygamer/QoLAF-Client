import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ButtonQueue, ButtonPvPQuickMatch } from '../game/Bindings';

/** Original queue controls reject actions before changing state during service loss. */
export function installQueueActions(api: API): void {
  const reflection = new GameReflection(api);
  for (const prototype of [ButtonQueue.prototype, ButtonPvPQuickMatch.prototype]) {
    for (const action of ['join', 'leave', 'accept'] as const) {
      reflection.around(prototype, action, function (next, event) {
        if (this.g.get_isLeaving() || !this.g.serviceConnection?.get_connected()) return;
        return next(event);
      });
    }
  }
}
