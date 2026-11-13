import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  ShipManager,
  ShipFactory,
  SpawnManager,
  BossManager,
  GameObject,
  type GameScene,
} from '../game/Bindings';
import { BossSpawnTimers, type EnemySpawnIdentity } from './BossSpawnTimers';

const identities = new WeakMap<GameObject, EnemySpawnIdentity>();
const models = new WeakMap<GameScene, BossSpawnTimers>();

export function bossSpawnTimers(game: GameScene): BossSpawnTimers {
  let model = models.get(game);
  if (!model) {
    model = new BossSpawnTimers(game, (enemy) => identities.get(enemy));
    models.set(game, model);
  }
  return model;
}

/** Install before Haxe caches bound message handlers. Copy identities before destruction. */
export function installBossSpawnTimerHooks(api: API): void {
  const reflection = new GameReflection(api);
  // The native factory does not retain the definition key, and only orbiting
  // enemies keep their spawner. Observe the lookup inside each spawn record.
  let spawning: { game: GameScene; spawnerKey: string } | undefined;
  reflection.around(ShipManager.prototype, 'spawnEnemy', function (next, ...args) {
    const previous = spawning;
    spawning = { game: this.g, spawnerKey: '' };
    try {
      return next(...args);
    } finally {
      spawning = previous;
    }
  });
  reflection.before(SpawnManager.prototype, 'getSpawnerByKey', function (key: string) {
    if (spawning && spawning.game === this.g) spawning.spawnerKey = String(key ?? '');
  });
  reflection.after(ShipFactory, 'createEnemy', function (enemy, game, key) {
    if (enemy)
      identities.set(enemy, {
        definitionKey: key,
        spawnerKey: spawning?.game === game ? spawning.spawnerKey : '',
      });
  });
  reflection.after(
    ShipManager.prototype,
    'createSetEnemy',
    function (_result, enemy, _id, _heading, _count, _time, spawner) {
      const identity = identities.get(enemy);
      if (identity && spawner?.key != null) identity.spawnerKey = String(spawner.key);
    },
  );
  reflection.before(ShipManager.prototype, 'killed', function (message, start) {
    const enemy = this.enemiesById.h[message.getInt(start)];
    if (!enemy?.alive || enemy.rareType === 6) return;
    const identity = identities.get(enemy);
    if (identity)
      bossSpawnTimers(this.g).recordDeath(
        'enemy',
        identity.definitionKey,
        identity.spawnerKey,
        enemy.get_id(),
      );
  });
  reflection.before(BossManager.prototype, 'killBoss', function (boss) {
    if (this.bosses.includes(boss))
      bossSpawnTimers(this.g).recordDeath('boss', String(boss.key), '', null);
  });
  reflection.before(GameObject.prototype, 'reset', function () {
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
