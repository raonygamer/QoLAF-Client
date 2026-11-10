import type { Raw } from '../api/Types';

export interface BossSpawnDescription {
  name: string;
  detail: string;
  boss: boolean;
  innerRadius: number;
  outerRadius: number;
}

/** Read configured spawn identities; names/probabilities never identify live enemies. */
export class BossSpawnCatalog {
  private static readonly maxEnemyOptions = 512;
  private static readonly netherBlobKey = 'qPt44KawmEuVs6VFL5vJ9g';

  static isNetherBlobSpawner(spawner: Raw | null): boolean {
    if (spawner?.hidden !== true) return false;
    const contains = (values: unknown): boolean =>
      Array.isArray(values) &&
      values
        .slice(0, this.maxEnemyOptions)
        .some((entry) => entry === this.netherBlobKey || entry?.key === this.netherBlobKey);
    return (
      spawner.enemy === this.netherBlobKey ||
      contains(spawner.enemies) ||
      (spawner.hasSecondSpawn === true &&
        (spawner.enemy2 === this.netherBlobKey || contains(spawner.enemies2)))
    );
  }

  static describeBoss(body: Raw | null, bosses: Raw | null): BossSpawnDescription | null {
    if (!body || !bosses || !body.boss || body.active === false) return null;
    const boss = bosses[body.boss];
    if (!boss?.name) return null;
    let detail = body.randomSpawnPoint === true ? 'Random spawn anchor' : 'Boss spawn';
    if (body.event != null && String(body.event).length > 0) detail += ' (event)';
    return { name: String(boss.name), detail, boss: true, innerRadius: 0, outerRadius: 0 };
  }

  static describeSpawner(spawner: Raw | null, enemies: Raw | null): BossSpawnDescription | null {
    if (!spawner || !enemies || spawner.hidden !== true) return null;
    const names: string[] = [];
    this.addName(names, spawner.enemy, enemies);
    if (spawner.hasSecondSpawn === true) this.addName(names, spawner.enemy2, enemies);
    return this.describeArea(names, spawner);
  }

  static describeSpawnerHeat(
    spawner: Raw | null,
    enemies: Raw | null,
  ): BossSpawnDescription | null {
    if (!spawner || !enemies || spawner.hidden === true) return null;
    const names: string[] = [];
    this.addName(names, spawner.enemy, enemies);
    this.addOptions(names, spawner.enemies, enemies);
    if (spawner.hasSecondSpawn === true) {
      this.addName(names, spawner.enemy2, enemies);
      this.addOptions(names, spawner.enemies2, enemies);
    }
    return this.describeArea(names, spawner);
  }

  private static describeArea(names: string[], spawner: Raw): BossSpawnDescription | null {
    if (!names.length) return null;
    const radius = (value: unknown): number => {
      const result = Number(value);
      return Number.isFinite(result) && result > 0 ? result : 0;
    };
    const innerRadius = radius(spawner.innerRadius);
    const outerRadius = Math.max(innerRadius, radius(spawner.outerRadius));
    return {
      name: names.join(' / '),
      detail: outerRadius > 0 ? 'Miniboss spawn area' : 'Miniboss spawn',
      boss: false,
      innerRadius,
      outerRadius,
    };
  }

  private static addOptions(names: string[], values: unknown, enemies: Raw): void {
    if (!Array.isArray(values)) return;
    for (const entry of values.slice(0, this.maxEnemyOptions)) {
      if (typeof entry === 'string') this.addName(names, entry, enemies);
      else if (entry && typeof entry === 'object' && Object.hasOwn(entry, 'key'))
        this.addName(names, entry.key, enemies);
    }
  }

  private static addName(names: string[], key: unknown, enemies: Raw): void {
    if (key == null || String(key).length === 0) return;
    const enemy = enemies[String(key)];
    if (enemy?.miniBoss !== true || !enemy.name) return;
    const name = String(enemy.name);
    if (!names.includes(name)) names.push(name);
  }
}
