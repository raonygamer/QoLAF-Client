import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PvpManager, DominationManager } from '../game/Bindings';
import { RosterRetry } from './RosterRetry';

export function installNativeRosterRetry(api: API): void {
  const reflection = new GameReflection(api);
  const retries = new WeakMap<PvpManager, RosterRetry>();
  const retry = (manager: PvpManager) => {
    let state = retries.get(manager);
    if (!state) {
      state = new RosterRetry();
      retries.set(manager, state);
    }
    return state;
  };
  for (const prototype of [PvpManager.prototype, DominationManager.prototype]) {
    reflection.around(prototype, 'update', function (next) {
      const players = this.g.playerManager;
      if (!players) return next();
      const before = this.requestTime;
      const due =
        before < this.g.time &&
        (this.roomStartTime === 0 || players.get_players().length > this.scoreList.length);
      const result = next();
      // Preserve native request contents and match logic. Back off only when
      // this update actually advanced the request deadline.
      if (due && this.requestTime !== before) this.requestTime = retry(this).requested(this.g.time);
      return result;
    });
  }
  reflection.after(PvpManager.prototype, 'm_pvpInitPlayers', function () {
    const players = this.g.playerManager;
    if (!players) return;
    this.requestTime = retry(this).received(
      this.g.time,
      players.get_players().length <= this.scoreList.length,
    );
  });
}
