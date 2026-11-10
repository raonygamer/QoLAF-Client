import { read, type Raw } from '../Api/Types';
import type { Settings } from '../Settings/Settings';
export class TargetSystem {
  current: Raw | null = null;
  previous: Raw | null = null;
  locked = false;
  private timeout = 0;
  constructor(
    private game: Raw,
    private config: Settings,
    private PlayerShip?: any,
  ) {}
  private me() {
    return read(this.game, 'me');
  }
  private player(unit: Raw) {
    return this.PlayerShip ? unit instanceof this.PlayerShip : !!unit.player;
  }
  valid(unit: Raw | null): unit is Raw {
    const ship = this.me()?.ship;
    return !!(
      ship &&
      unit?.alive &&
      unit !== ship &&
      (!this.player(unit) || (unit.player && !unit.player.isMe && !unit.landed))
    );
  }
  distance(unit: Raw) {
    const a = read(this.me()?.ship, 'pos'),
      b = read(unit, 'pos');
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
  }
  excluded(unit: Raw) {
    return (
      !this.player(unit) && this.config.exclude_af_faction_from_radar && unit.hasFaction?.('AF')
    );
  }
  private priority(unit: Raw | null) {
    if (!unit || !this.player(unit)) return 0;
    const mine = read(this.me(), 'group'),
      theirs = read(unit.player, 'group');
    return mine && theirs && mine.id === theirs.id ? -1 : 1;
  }
  clear(force = false) {
    if (this.locked && !force) return;
    this.previous = this.current;
    this.current = null;
    this.locked = false;
    this.timeout = 0;
  }
  select(unit: Raw | null, force = false): boolean {
    if (!unit) {
      this.clear(force);
      return true;
    }
    if (unit === this.current) return true;
    if (!force && (this.locked || this.timeout > 0)) return false;
    if (!this.valid(unit) || this.distance(unit) >= this.config.target_search_distance)
      return false;
    this.previous = this.current;
    this.current = unit;
    this.locked = false;
    this.timeout = 0.5;
    return true;
  }
  update(dt: number) {
    this.timeout = Math.max(0, this.timeout - Math.max(0, Number.isFinite(dt) ? dt : 0));
    if (
      this.current &&
      (!this.valid(this.current) ||
        (!this.locked && this.distance(this.current) >= this.config.target_search_distance))
    )
      this.clear(true);
  }
  auto(unit: Raw) {
    if (
      !this.config.auto_target ||
      this.locked ||
      unit === this.current ||
      this.excluded(unit) ||
      !this.valid(unit)
    )
      return false;
    if (this.current && this.priority(unit) < this.priority(this.current)) return false;
    return this.select(unit, !!this.current && this.priority(unit) > this.priority(this.current));
  }
}
