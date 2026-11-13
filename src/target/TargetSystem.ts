import type { RenderedGameObject } from '../game/RenderedGameObject';
import {
  NativeEventDispatcher,
  PlayerShip,
  type GameScene,
  type NativeEvent,
  type Unit,
} from '../game/Bindings';
import { createTargetUpdatedEvent } from './TargetUpdatedEvent';
import { samePlayerGroup } from './PlayerGroup';
import type { Settings } from '../settings/Settings';
export class TargetSystem {
  private lifecycles = new WeakMap<Unit, { native: number | undefined; revision: number }>();
  current: Unit | null = null;
  previous: Unit | null = null;
  private lockedTarget = false;
  get locked(): boolean {
    return this.lockedTarget;
  }
  set locked(value: boolean) {
    this.lockedTarget = value && this.valid(this.current);
  }
  private timeout = 0;
  private events: NativeEventDispatcher | null = null;

  get unit(): Unit | null {
    return this.current;
  }
  set unit(value: Unit | null) {
    this.select(value);
  }
  get oldUnit(): Unit | null {
    return this.previous;
  }

  /** Original target_updated_event surface, backed by the game's event dispatcher. */
  initializeEvents(): void {
    this.events = new NativeEventDispatcher(this);
  }

  addEventListener<E extends NativeEvent>(
    type: string,
    listener: (event: E) => void,
    capture = false,
    priority = 0,
    weak = false,
  ): void {
    this.events?.addEventListener(type, listener, capture, priority, weak);
  }

  removeEventListener<E extends NativeEvent>(
    type: string,
    listener: (event: E) => void,
    capture = false,
  ): void {
    this.events?.removeEventListener(type, listener, capture);
  }

  hasEventListener(type: string): boolean {
    return this.events?.hasEventListener(type) ?? false;
  }

  willTrigger(type: string): boolean {
    return this.events?.willTrigger(type) ?? false;
  }

  dispatchEvent(event: NativeEvent): boolean {
    return this.events?.dispatchEvent(event) ?? true;
  }

  private notifyChanged(): void {
    if (!this.events) return;
    this.events.dispatchEvent(createTargetUpdatedEvent(this));
  }

  disposeEvents(): void {
    // Release the dispatcher and its listener graph with the game session.
    this.events = null;
  }
  /** Invalidate snapshots on both native pool resets and manager removal. */
  lifecycle(unit: Unit & RenderedGameObject): number {
    const native = unit.get_lifecycleId?.();
    let state = this.lifecycles.get(unit);
    if (!state) {
      state = { native, revision: 0 };
      this.lifecycles.set(unit, state);
    } else if (state.native !== native) {
      state.native = native;
      state.revision++;
    }
    return state.revision;
  }
  remove(unit: Unit): void {
    // Removal invalidates immediately, even when native reset happens later.
    this.lifecycle(unit);
    this.lifecycles.get(unit)!.revision++;
    if (this.current === unit) this.clear(true);
  }
  constructor(
    private game: Pick<GameScene, 'get_me'>,
    private config: Settings,
  ) {}
  private me() {
    return this.game.get_me();
  }
  private player(unit: Unit): unit is PlayerShip {
    return unit instanceof PlayerShip;
  }
  valid(unit: Unit | null): unit is Unit {
    const ship = this.me()?.ship;
    return !!(
      ship &&
      unit?.alive &&
      unit !== ship &&
      (!this.player(unit) || (unit.player && !unit.player.isMe && !unit.get_landed()))
    );
  }
  distance(unit: Unit) {
    const a = this.me()?.ship?.get_pos(),
      b = unit.get_pos();
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
  }
  excluded(unit: Unit) {
    return !this.player(unit) && this.config.exclude_af_faction_from_radar && unit.hasFaction('AF');
  }
  private priority(unit: Unit | null) {
    if (!unit || !this.player(unit)) return 0;
    return samePlayerGroup(this.me(), unit.player) ? -1 : 1;
  }
  clear(force = false) {
    if (this.locked && !force) return;
    if (!this.current && !this.previous) {
      this.locked = false;
      return;
    }
    this.previous = this.current;
    this.current = null;
    this.locked = false;
    this.timeout = 0;
    this.notifyChanged();
  }
  select(unit: Unit | null, force = false): boolean {
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
    this.notifyChanged();
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
  auto(unit: Unit | null) {
    if (
      !unit ||
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
