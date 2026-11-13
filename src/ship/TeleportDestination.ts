import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { AIStateMachine, AITeleport, ShipManager } from '../game/Bindings';

/** Target snapshots omit teleport destinations; preserve the source client's fallback. */
export function installTeleportDestination(api: API): void {
  const reflection = new GameReflection(api);
  let targetSyncDepth = 0;
  reflection.around(ShipManager.prototype, 'syncEnemyTarget', function (next, message, start) {
    targetSyncDepth++;
    try {
      return next(message, start);
    } finally {
      targetSyncDepth--;
    }
  });
  reflection.before(AIStateMachine.prototype, 'changeState', function (state) {
    if (!targetSyncDepth || !(state instanceof AITeleport)) return;
    const ship = state.s;
    const course = ship.get_course();
    if (!course) return;
    const position = this.inState('AITeleportEntry')
      ? (ship.engine?.get_pos() ?? course.pos)
      : course.pos;
    state.targetX = position.x;
    state.targetY = position.y;
  });
  reflection.before(AITeleport.prototype, 'enter', function () {
    const position = this.s.get_course()?.pos;
    if (!position) return;
    if (!Number.isFinite(this.targetX)) this.targetX = position.x;
    if (!Number.isFinite(this.targetY)) this.targetY = position.y;
  });
}
