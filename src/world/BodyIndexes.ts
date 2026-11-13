import type { API } from '../api/Types';
import { BodyManager, type Body } from '../game/Bindings';

/** Original per-room body key index, retaining native lookup for late bodies. */
export function installBodyIndexes(api: API): void {
  const indexes = new WeakMap<BodyManager, Map<string, Body>>();
  api.around(BodyManager.prototype, 'getBodyByKey', function (next, key) {
    let index = indexes.get(this);
    if (!index) {
      index = new Map();
      for (const body of this.bodies) if (body.key != null) index.set(body.key, body);
      indexes.set(this, index);
    }
    const cached = index.get(key);
    if (cached?.key === key) return cached;
    index.delete(key);
    const found = next(key);
    if (found) index.set(key, found);
    return found;
  });
  api.before(BodyManager.prototype, 'dispose', function () {
    indexes.delete(this);
  });
}
