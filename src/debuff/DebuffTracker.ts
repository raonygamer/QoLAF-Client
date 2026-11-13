import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Unit, type GameScene } from '../game/Bindings';

export class DebuffEffect {
  stacks = 1;
  constructor(
    readonly debuff: number,
    public duration: number,
    public startTime: number,
  ) {
    this.duration = Math.max(0, duration);
  }
  remaining(now: number): number {
    return Math.max(0, Math.trunc(this.startTime + this.duration - now));
  }
  refresh(duration: number, now: number): void {
    if (this.debuff === 1 || this.debuff === 3) this.stacks++;
    if (duration >= 0) this.duration = duration;
    this.startTime = now;
  }
}

/** Display-only observations; never writes native damage, healing or regen state. */
export class DebuffTracker {
  private effects = new WeakMap<object, DebuffEffect[]>();
  constructor(private readonly now: () => number) {}
  get(unit: object): DebuffEffect[] {
    this.expire(unit);
    return this.effects.get(unit) ?? [];
  }
  expire(unit: object): void {
    const live = this.effects.get(unit);
    if (!live?.length) return;
    const now = this.now();
    for (let index = live.length - 1; index >= 0; index--)
      if (live[index].startTime + live[index].duration <= now) live.splice(index, 1);
  }
  record(unit: Pick<Unit, 'alive'>, type: number, duration: number): void {
    if (!unit.alive || !Number.isInteger(type) || type < 0 || type >= 12) return;
    // Original trackDebuff refreshes before the next explicit expiry update.
    const effects = this.effects.get(unit) ?? [];
    const existing = effects.find((effect) => effect.debuff === type);
    if (existing) existing.refresh(duration, this.now());
    else effects.push(new DebuffEffect(type, Math.max(0, duration), this.now()));
    this.effects.set(unit, effects);
  }
  clear(unit: object): void {
    this.effects.delete(unit);
  }
}

export function installDebuffTracker(api: API, game: Pick<GameScene, 'time'>): DebuffTracker {
  const tracker = new DebuffTracker(() => game.time);
  const reflection = new GameReflection(api);
  reflection.before(Unit.prototype, 'doDOTEffect', function (seconds, _visual, type = -1) {
    if (this.g === game) tracker.record(this, type, Math.trunc(seconds * 1000));
  });
  reflection.before(Unit.prototype, 'update', function () {
    if (this.g === game) tracker.expire(this);
  });
  for (const name of ['reset', 'destroy'] as const)
    reflection.before(Unit.prototype, name, function () {
      tracker.clear(this);
    });
  return tracker;
}
