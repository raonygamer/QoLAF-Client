import { MovementReplay, type ReplayHeading } from './MovementReplay';

export interface SelfHeading extends ReplayHeading {
  pos: { x: number; y: number };
  speed: { x: number; y: number };
  rotation: number;
  clone(): SelfHeading;
  copy(other: SelfHeading): void;
  almostEqual(other: SelfHeading): boolean;
}

export interface SelfCourseOwner<Heading extends SelfHeading = SelfHeading> {
  ship: object;
  converger: object;
  course: Heading;
  advance(heading: Heading): void;
  setTarget(heading: Heading): void;
  clearTarget(): void;
}

export type ReconciliationObserver = (
  raw: SelfHeading,
  replay: SelfHeading,
  local: SelfHeading,
  override: string | null,
) => void;

/** ShipSync's latest complete self transform is consumed once at the fixed update boundary. */
export class SelfCourseQueue<Heading extends SelfHeading = SelfHeading> {
  private pending: { owner: SelfCourseOwner<Heading>; heading: Heading } | null = null;
  private ship: object | null = null;
  private converger: object | null = null;
  private latestTime = -Infinity;
  private latest: SelfHeading | null = null;

  constructor(
    private replay: MovementReplay,
    private observe: ReconciliationObserver,
  ) {}

  reset(owner: SelfCourseOwner<Heading> | null = null, timestamp = NaN): void {
    this.ship = owner?.ship ?? null;
    this.converger = owner?.converger ?? null;
    this.latestTime = Number.isNaN(timestamp) ? -Infinity : timestamp;
    this.latest = null;
    this.pending = null;
  }

  queue(owner: SelfCourseOwner<Heading>, heading: Heading): void {
    this.prepareOwner(owner);
    if (this.pending) {
      if (heading.time < this.pending.heading.time) {
        this.observe(
          heading,
          owner.course,
          owner.course,
          `ignored-stale(${(this.pending.heading.time - heading.time).toFixed(0)}ms)`,
        );
        return;
      }
      if (heading.time === this.pending.heading.time) {
        this.pending.heading.copy(heading);
        return;
      }
    } else if (this.ignoreApplied(owner, heading)) return;
    this.pending = { owner, heading };
  }

  flush(current: SelfCourseOwner<Heading> | null): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    if (
      !current ||
      current.ship !== pending.owner.ship ||
      current.converger !== pending.owner.converger
    )
      return;
    this.prepareOwner(current);
    const heading = pending.heading;
    if (this.ignoreApplied(current, heading)) return;
    this.latestTime = heading.time;
    const raw = heading.clone();
    this.latest = raw.clone();
    if (!this.fastForward(current, heading)) {
      current.clearTarget();
      this.observe(
        raw,
        current.course,
        current.course,
        `ignored-too-old(${(current.course.time - raw.time).toFixed(0)}ms)`,
      );
      return;
    }
    if (!current.course.almostEqual(heading)) current.setTarget(heading);
    else current.clearTarget();
    this.observe(raw, heading, current.course, null);
  }

  fastForward(owner: SelfCourseOwner<Heading>, heading: Heading): boolean {
    if (owner.course.time - heading.time > 1000 * 33) return false;
    this.replay.prepareHeading(owner.ship, owner.converger, heading);
    while (heading.time < owner.course.time) {
      this.replay.run(heading, heading.time);
      owner.advance(heading);
    }
    if (heading.time === owner.course.time) {
      heading.accelerate = owner.course.accelerate;
      heading.deaccelerate = owner.course.deaccelerate;
      heading.rotateLeft = owner.course.rotateLeft;
      heading.rotateRight = owner.course.rotateRight;
    }
    return true;
  }

  private prepareOwner(owner: SelfCourseOwner<Heading>): void {
    if (owner.ship !== this.ship || owner.converger !== this.converger) this.reset(owner);
  }

  private ignoreApplied(owner: SelfCourseOwner<Heading>, heading: Heading): boolean {
    if (
      heading.time < this.latestTime ||
      (heading.time === this.latestTime && headingsEqual(heading, this.latest))
    ) {
      this.observe(
        heading,
        owner.course,
        owner.course,
        heading.time === this.latestTime
          ? 'ignored-duplicate'
          : `ignored-stale(${(this.latestTime - heading.time).toFixed(0)}ms)`,
      );
      return true;
    }
    return false;
  }
}

export function headingsEqual(first: SelfHeading | null, second: SelfHeading | null): boolean {
  return (
    !!first &&
    !!second &&
    first.time === second.time &&
    first.pos.x === second.pos.x &&
    first.pos.y === second.pos.y &&
    first.speed.x === second.speed.x &&
    first.speed.y === second.speed.y &&
    first.rotation === second.rotation &&
    first.accelerate === second.accelerate &&
    first.deaccelerate === second.deaccelerate &&
    first.rotateLeft === second.rotateLeft &&
    first.rotateRight === second.rotateRight
  );
}
