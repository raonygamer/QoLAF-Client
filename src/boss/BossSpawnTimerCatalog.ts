/** PlayerIO cache values retain their serialized scalar representation. */
type CacheScalar = string | number | boolean | null;

export interface SpawnAnchor {
  key?: string;
  hidden?: boolean;
  alive?: boolean;
}

interface EventDefinition {
  active?: boolean;
  event?: CacheScalar;
}

export interface BossAnchorDefinition extends EventDefinition {
  boss?: string | null;
  spawnTime?: CacheScalar;
}

export interface EnemySpawnOption {
  key?: string | null;
  probability?: CacheScalar;
}

export interface EnemySpawnerDefinition extends EventDefinition {
  hasSecondSpawn?: boolean;
  triggeredByMission?: boolean;
  triggeredByTimer?: boolean;
  enemy?: string | null;
  enemy2?: string | null;
  enemies?: readonly (string | EnemySpawnOption | null)[] | null;
  enemies2?: readonly (string | EnemySpawnOption | null)[] | null;
  maxActiveEnemies?: CacheScalar;
  maxActiveEnemies2?: CacheScalar;
  spawnOnDeath?: boolean;
  spawnOnDeath2?: boolean;
  resetTime?: CacheScalar;
  resetTime2?: CacheScalar;
}

export interface TimerSpawner extends SpawnAnchor {
  obj?: EnemySpawnerDefinition | null;
  isBossUnit?: boolean;
}

export interface TimerBody extends SpawnAnchor {
  obj?: BossAnchorDefinition | null;
  spawners?: readonly (TimerSpawner | null)[] | null;
}

export interface TimerDefinition {
  name?: string;
  miniBoss?: boolean;
}

type DefinitionTable = Readonly<Record<string, TimerDefinition | undefined>> | null;

export interface BossTimerEntry {
  id: string;
  key: string;
  kind: 'boss' | 'enemy';
  name: string;
  primary: boolean;
  conditional: boolean;
  sources: { anchor: SpawnAnchor; periodMs: number }[];
  alive?: boolean;
  seenAlive?: boolean;
}

/** Original BossSpawnTimerCatalog: cache timing is an estimate, never a deadline. */
export class BossSpawnTimerCatalog {
  static readonly zhersisKey = '1gr5DQtiFU2VF1DR2lmd0A';
  private static readonly maxOptions = 512;

  static build(
    bodies: readonly (TimerBody | null)[] | null,
    bosses: DefinitionTable,
    enemies: DefinitionTable,
  ): BossTimerEntry[] {
    const rows = new Map<string, BossTimerEntry>();
    const add = (
      kind: BossTimerEntry['kind'],
      key: string,
      name: string,
      primary: boolean,
      conditional: boolean,
      anchor: SpawnAnchor,
      periodMs: number,
    ) => {
      if (conditional) periodMs = 0;
      const id = `${kind}:${key}`;
      let row = rows.get(id);
      if (!row) {
        row = {
          id,
          key,
          kind,
          name: name.replace(/\s+lvl\s+.*$/i, ''),
          primary,
          conditional,
          sources: [],
        };
        rows.set(id, row);
      } else row.conditional &&= conditional;
      if (!row.sources.some((source) => source.anchor === anchor && source.periodMs === periodMs))
        row.sources.push({ anchor, periodMs });
    };
    for (const body of bodies ?? []) {
      if (!body?.obj || body.obj.active === false) continue;
      const key = String(body.obj.boss ?? '');
      if (key && bosses?.[key]?.name)
        add(
          'boss',
          key,
          String(bosses[key].name),
          true,
          this.hasEvent(body.obj),
          body,
          this.period(body.obj.spawnTime),
        );
      for (const spawner of body.spawners ?? []) {
        if (!spawner?.obj || spawner.isBossUnit === true || spawner.obj.active === false) continue;
        const data = spawner.obj;
        for (const suffix of data.hasSecondSpawn === true
          ? (['', '2'] as const)
          : ([''] as const)) {
          const values = data[`enemies${suffix}`];
          const options = this.optionKeys(values, data[`enemy${suffix}`]);
          const capacity = data[`maxActiveEnemies${suffix}`];
          if (capacity != null && Number.isFinite(Number(capacity)) && Number(capacity) <= 0)
            continue;
          const gated =
            data[`spawnOnDeath${suffix}`] === true ||
            data.triggeredByMission === true ||
            data.triggeredByTimer === true;
          let periodMs = this.period(data[`resetTime${suffix}`]);
          if (
            gated ||
            options.length !== 1 ||
            (Array.isArray(values) && values.length > this.maxOptions) ||
            (capacity != null && Number(capacity) > 1)
          )
            periodMs = 0;
          const conditional =
            this.hasEvent(body.obj) ||
            this.hasEvent(data) ||
            data.triggeredByMission === true ||
            data.triggeredByTimer === true;
          for (const enemyKey of options) {
            const enemy = enemies?.[enemyKey];
            if (enemy?.miniBoss === true && enemy.name)
              add(
                'enemy',
                enemyKey,
                String(enemy.name),
                enemyKey === this.zhersisKey,
                conditional,
                spawner,
                periodMs,
              );
          }
        }
      }
    }
    return [...rows.values()].sort((a, b) => {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      const left = a.name.toLowerCase(),
        right = b.name.toLowerCase();
      if (left !== right) return left < right ? -1 : 1;
      return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
    });
  }

  private static optionKeys(values: unknown, legacy: unknown): string[] {
    const result = new Set<string>();
    if (Array.isArray(values) && values.length > 0) {
      for (const option of values.slice(0, this.maxOptions)) {
        let key = '';
        if (typeof option === 'string') key = option;
        else if (
          option &&
          typeof option === 'object' &&
          Object.hasOwn(option, 'key') &&
          option.key != null
        ) {
          if (
            Object.hasOwn(option, 'probability') &&
            (!Number.isFinite(Number(option.probability)) || Number(option.probability) <= 0)
          )
            continue;
          key = String(option.key);
        }
        if (key) result.add(key);
      }
    } else if (legacy != null && String(legacy)) result.add(String(legacy));
    return [...result];
  }

  private static period(value: unknown): number {
    const milliseconds = Number(value) * 60000;
    return Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 86400000
      ? milliseconds
      : 0;
  }

  private static hasEvent(value: EventDefinition): boolean {
    return value?.event != null && String(value.event).length > 0;
  }
}
