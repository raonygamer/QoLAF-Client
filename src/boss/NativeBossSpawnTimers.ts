import { read, type API, type Raw } from '../api/Types';
import { BossSpawnTimers, type EnemySpawnIdentity } from './BossSpawnTimers';

const identities = new WeakMap<Raw, EnemySpawnIdentity>();
const models = new WeakMap<Raw, BossSpawnTimers>();

export function bossSpawnTimers(game: Raw): BossSpawnTimers {
  let model = models.get(game);
  if (!model) {
    model = new BossSpawnTimers(game, (enemy) => identities.get(enemy));
    models.set(game, model);
  }
  return model;
}

/** Install before Haxe caches bound message handlers. Copy identities before destruction. */
export function installBossSpawnTimerHooks(api: API): void {
  const manager = api.cls('core.ship.ShipManager')?.prototype;
  const factory = api.cls('core.ship.ShipFactory')!;
  const bossManager = api.cls('core.boss.BossManager')?.prototype;
  if (!manager || !factory || !bossManager) return;
  const spawnerManager = api.cls('core.spawner.SpawnManager')?.prototype;
  // The native factory does not retain the definition key, and only orbiting
  // enemies keep their spawner. Observe the lookup inside each spawn record.
  let spawning: { game: Raw; spawnerKey: string } | undefined;
  api.around(manager, 'spawnEnemy', function (next, ...args) {
    const previous = spawning;
    spawning = { game: this.g, spawnerKey: '' };
    try {
      return next(...args);
    } finally {
      spawning = previous;
    }
  });
  if (spawnerManager)
    api.before(spawnerManager, 'getSpawnerByKey', function (key: string) {
      if (spawning && spawning.game === this.g) spawning.spawnerKey = String(key ?? '');
    });
  api.after(factory, 'createEnemy', function (enemy: Raw | null, game: Raw, key: string) {
    if (enemy)
      identities.set(enemy, {
        definitionKey: key,
        spawnerKey: spawning?.game === game ? spawning.spawnerKey : '',
      });
  });
  api.after(
    manager,
    'createSetEnemy',
    function (_result, enemy: Raw, _id, _heading, _count, _time, spawner: Raw | null) {
      const identity = identities.get(enemy);
      if (identity && spawner?.key != null) identity.spawnerKey = String(spawner.key);
    },
  );
  api.before(manager, 'killed', function (message: Raw, start: number) {
    const enemy = this.enemiesById.h[String(message.getInt(start))];
    if (!enemy?.alive || enemy.rareType === 6) return;
    const identity = identities.get(enemy);
    if (identity)
      bossSpawnTimers(this.g).recordDeath(
        'enemy',
        identity.definitionKey,
        identity.spawnerKey,
        read(enemy, 'id'),
      );
  });
  api.before(bossManager, 'killBoss', function (boss: Raw) {
    if (this.bosses.includes(boss))
      bossSpawnTimers(this.g).recordDeath('boss', String(boss.key), '', null);
  });
  const object = api.cls('core.GameObject')?.prototype;
  if (object)
    api.before(object, 'reset', function () {
      identities.delete(this);
    });
  api.onGame((game, session) => {
    bossSpawnTimers(game);
    session.defer(() => {
      models.get(game)?.dispose();
      models.delete(game);
    });
  });
}
