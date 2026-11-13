import type { API } from '../api/Types';
import { Body } from '../game/Bindings';
import { BodySpawnerIndex } from './BodySpawnerIndex';

/** Original BodyFactory grouping, retaining native Body.createSpawner placement. */
export function installBodySpawners(api: API): void {
  const index = new BodySpawnerIndex();
  api.around(Body.prototype, 'addSpawners', function (_next, definition, key) {
    const table: unknown = this.dataManager.loadTable('Spawners');
    const spawners = index.forBody(table, key);
    // Keep current Haxe integer radius arithmetic; this change only removes scans.
    this.hostileZoneRadius = spawners.length ? (1.5 * this.collisionRadius) | 0 : 0;
    this.preDraw(definition);
    for (const spawner of spawners)
      this.createSpawner(spawner.definition, spawner.key, this, spawners.length);
  });
}
