import type { API } from '../api/Types';
import { MissionsList, SceneBase } from '../game/Bindings';

/** Original MissionsList sends its viewed acknowledgement without an RPC handler. */
export function installMissionRead(api: API): void {
  const scopes = new Map<SceneBase, number>();
  api.around(MissionsList.prototype, 'trySetMissionsViewed', function (next) {
    const scene = this.g;
    scopes.set(scene, (scopes.get(scene) ?? 0) + 1);
    try {
      return next();
    } finally {
      const depth = (scopes.get(scene) ?? 1) - 1;
      if (depth) scopes.set(scene, depth);
      else scopes.delete(scene);
    }
  });
  api.around(SceneBase.prototype, 'rpc', function (next, type, callback, values = []) {
    if (scopes.has(this) && type === 'setMissionsViewed' && callback == null) {
      this.send(type, values);
      return;
    }
    return next(type, callback, values);
  });
}
