import type { Raw } from '../api/Types';
import type { Settings } from '../settings/Settings';
import type { TargetPresentation } from './TargetPresentation';
import type { TargetSystem } from './TargetSystem';

interface NearbyTarget {
  unit: Raw;
  lifecycle: number;
}

/** Source TargetInfoElement's sorted snapshot, guarded against pooled unit reuse. */
export class NearbyTargets {
  private entries: NearbyTarget[] = [];

  constructor(
    private target: TargetSystem,
    private info: TargetPresentation,
    private config: Settings,
  ) {}

  refresh(units: Raw[], count: number): void {
    const seen = new Set<Raw>();
    this.entries = units
      .filter((unit) => {
        if (!this.eligible(unit)) return false;
        const identity = this.info.identity(unit);
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      })
      .sort((a, b) => this.info.compare(a, b, (unit) => this.target.distance(unit)))
      .slice(0, count)
      .map((unit) => ({ unit, lifecycle: this.target.lifecycle(unit) }));
  }

  at(index: number): Raw | null {
    const entry = this.entries[index];
    return entry && this.current(entry) ? entry.unit : null;
  }

  select(unit: Raw): boolean {
    const entry = this.entries.find((candidate) => candidate.unit === unit);
    if (!entry || !this.current(entry) || !this.target.select(unit, true)) return false;
    this.target.locked = true;
    return true;
  }

  private current(entry: NearbyTarget): boolean {
    return this.target.lifecycle(entry.unit) === entry.lifecycle && this.eligible(entry.unit);
  }

  private eligible(unit: Raw): boolean {
    const active = this.target.current;
    return !!(
      unit &&
      unit.isHostile &&
      this.target.valid(unit) &&
      !this.target.excluded(unit) &&
      this.target.distance(unit) < this.config.target_search_distance &&
      (!active || this.info.identity(unit) !== this.info.identity(active))
    );
  }
}
