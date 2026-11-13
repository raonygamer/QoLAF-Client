import type { API } from '../api/Types';
import { SpawnManager, type Spawner } from '../game/Bindings';

interface SpawnerIndex {
  keys: Map<string, Spawner>;
  ids: Map<number, Spawner>;
}

/** Original lookup indexes, with native fallback for spawners registered later. */
export function installSpawnerIndexes(api: API): void {
  const indexes = new WeakMap<SpawnManager, SpawnerIndex>();
  const indexFor = (manager: SpawnManager) => {
    let index = indexes.get(manager);
    if (!index) {
      index = { keys: new Map(), ids: new Map() };
      for (const spawner of manager.spawners) {
        if (spawner.key != null) index.keys.set(spawner.key, spawner);
        const id = spawner.get_id();
        if (id !== 0) index.ids.set(id, spawner);
      }
      indexes.set(manager, index);
    }
    return index;
  };
  api.around(SpawnManager.prototype, 'getSpawnerByKey', function (next, key) {
    const index = indexFor(this);
    const cached = index.keys.get(key);
    if (cached?.key === key) return cached;
    index.keys.delete(key);
    const found = next(key);
    if (found) index.keys.set(key, found);
    return found;
  });
  api.around(SpawnManager.prototype, 'getSpawnerById', function (next, id) {
    const index = indexFor(this);
    const cached = index.ids.get(id);
    if (cached?.get_id() === id) return cached;
    index.ids.delete(id);
    const found = next(id);
    if (found && id !== 0) index.ids.set(id, found);
    return found;
  });
  api.after(SpawnManager.prototype, 'syncSpawners', function () {
    const index = indexes.get(this);
    if (!index) return;
    index.ids.clear();
    for (const spawner of this.spawners) {
      const id = spawner.get_id();
      if (id !== 0) index.ids.set(id, spawner);
    }
  });
  api.before(SpawnManager.prototype, 'removeSpawner', function (spawner) {
    const index = indexes.get(this);
    if (!index) return;
    // Remove all remembered identities in case a server sync reassigned its ID.
    for (const [key, value] of index.keys) if (value === spawner) index.keys.delete(key);
    for (const [id, value] of index.ids) if (value === spawner) index.ids.delete(id);
  });
  api.before(SpawnManager.prototype, 'dispose', function () {
    indexes.delete(this);
  });
}
