import type { API, Raw } from '../api/Types';

export class DebuffEffect {
  stacks = 1;
  constructor(
    readonly debuff: number,
    public duration: number,
    public startTime: number,
  ) {}
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
  private effects = new WeakMap<Raw, DebuffEffect[]>();
  constructor(private readonly now: () => number) {}
  get(unit: Raw): DebuffEffect[] {
    const live = this.effects.get(unit) ?? [];
    const now = this.now();
    for (let index = live.length - 1; index >= 0; index--)
      if (live[index].startTime + live[index].duration <= now) live.splice(index, 1);
    return live;
  }
  record(unit: Raw, type: number, duration: number): void {
    if (!unit.alive || !Number.isInteger(type) || type < 0 || type >= 12) return;
    const effects = this.get(unit);
    const existing = effects.find((effect) => effect.debuff === type);
    if (existing) existing.refresh(duration, this.now());
    else effects.push(new DebuffEffect(type, Math.max(0, duration), this.now()));
    this.effects.set(unit, effects);
  }
  clear(unit: Raw): void {
    this.effects.delete(unit);
  }
}

export function installDebuffTracker(api: API, game: Raw): DebuffTracker {
  const tracker = new DebuffTracker(() => game.time);
  const native = api.cls('core.unit.Unit')?.prototype;
  if (typeof native?.doDOTEffect === 'function')
    api.before(native, 'doDOTEffect', function (seconds, _visual, type = -1) {
      if (this.g === game) tracker.record(this, type, Math.trunc(seconds * 1000));
    });
  for (const name of ['reset', 'destroy'])
    if (typeof native?.[name] === 'function')
      api.before(native, name, function () {
        tracker.clear(this);
      });
  return tracker;
}
