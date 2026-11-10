import { read, type API, type Raw } from '../api/Types';

/** Sidecar life/aggro identity; never changes native targets or weapon state. */
export class EnemyTargetObservations {
  private readonly lives = new WeakMap<Raw, number>();
  private readonly targets = new WeakMap<Raw, { id: number; revision: number }>();
  life(unit: Raw): number {
    return this.lives.get(unit) ?? 0;
  }
  revision(unit: Raw): number {
    return this.targets.get(unit)?.revision ?? 0;
  }
  reset(unit: Raw): void {
    this.lives.set(unit, this.life(unit) + 1);
    this.targets.delete(unit);
  }
  record(unit: Raw | undefined, id: number): void {
    if (!unit) return;
    const previous = this.targets.get(unit);
    if (previous?.id === id) return;
    this.targets.set(unit, { id, revision: (previous?.revision ?? 0) + 1 });
  }
}

export function observeEnemyTargets(
  api: API,
  lookup: (game: Raw) => EnemyTargetObservations | undefined,
): void {
  const manager = api.cls('core.ship.ShipManager')?.prototype;
  const enemy = (game: Raw, id: number) => game.shipManager.enemiesById.h[String(id)];
  const length = (message: Raw) => read(message, 'length', 0);
  const after = (
    name: string,
    callback: (this: Raw, observations: EnemyTargetObservations, ...args: any[]) => void,
  ) => {
    if (typeof manager?.[name] === 'function')
      api.after(manager, name, function (...args) {
        const observations = this.g ? lookup(this.g) : undefined;
        if (observations) callback.call(this, observations, ...args);
      });
  };
  after('onEnemyUpdate', function (observations, _result, message) {
    if (length(message) >= 4)
      observations.record(enemy(this.g, message.getInt(0)), message.getInt(3));
  });
  after('readEnemyEntry', function (observations, end, message, start) {
    const flags = message.getInt(start + 1);
    // Current native record reads target immediately before its optional fire mask.
    if (flags & 8) {
      const encodedTarget = message.getInt(end - 1 - (flags & 16 ? 1 : 0));
      observations.record(
        enemy(this.g, message.getInt(start)),
        encodedTarget > 0 ? encodedTarget - 1 : 0,
      );
    }
  });
  after('enemyFire', function (observations, _result, message, start = 0, recordLength = -1) {
    const end =
      recordLength >= 0 ? Math.min(length(message), start + recordLength - 2) : length(message);
    if (end > start + 3 && message.getBoolean(start + 2))
      observations.record(enemy(this.g, message.getInt(start)), message.getInt(start + 3));
  });
  after('syncEnemyTarget', function (observations, _result, message, start) {
    for (let index = start; index < length(message) - 1; ) {
      observations.record(enemy(this.g, message.getInt(index)), message.getInt(index + 2));
      index += 4 + message.getInt(index + 3);
    }
  });
  const unit = api.cls('core.unit.Unit')?.prototype;
  for (const name of ['reset', 'destroy'])
    if (typeof unit?.[name] === 'function')
      api.before(unit, name, function () {
        if (this.g) lookup(this.g)?.reset(this);
      });
}
