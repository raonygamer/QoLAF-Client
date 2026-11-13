import { CommandAcknowledgements } from './CommandAcknowledgements';
import { PacketCapture } from './PacketCapture';
import {
  angleDifference,
  formatReconciliation,
  headingKeys,
  snapshotHeading,
  type DebugHeading,
} from './HeadingGraphics';

/** Immutable receipt records and independently sampled live courses. Never advances simulation. */
export class HeadingDiagnostics {
  enabled = false;
  raw: DebugHeading | null = null;
  replay: DebugHeading | null = null;
  local: DebugHeading | null = null;
  action = 'none';
  lastSelfCourseAt = 0;
  lastFreshCourseAt = 0;
  stateProvider: (() => { course: DebugHeading; target: DebugHeading | null } | null) | null = null;
  inputProvider: (() => string) | null = null;

  constructor(
    private capture: PacketCapture,
    private acknowledgements: CommandAcknowledgements,
    private now: () => number,
  ) {}

  record(
    raw: DebugHeading,
    replay: DebugHeading,
    local: DebugHeading,
    action: string,
    fresh: boolean,
  ): void {
    if (!this.enabled || !this.capture.active || this.capture.paused) return;
    this.raw = snapshotHeading(raw);
    this.replay = snapshotHeading(replay);
    this.local = snapshotHeading(local);
    this.action = action;
    this.lastSelfCourseAt = this.now();
    if (fresh) this.lastFreshCourseAt = this.now();
    this.acknowledgements.authoritative(raw);
    this.capture.add(
      'SYNC',
      'heading',
      formatReconciliation(this.raw, this.replay, this.local, action),
    );
  }

  live(): { course: DebugHeading; target: DebugHeading | null } | null {
    try {
      const live = this.stateProvider?.();
      if (live?.course) return live;
    } catch {
      /* Receipt remains available after the live ship is replaced. */
    }
    return this.local ? { course: this.local, target: null } : null;
  }

  resetTimes(): void {
    this.lastSelfCourseAt = this.lastFreshCourseAt = 0;
  }

  status(live: ReturnType<HeadingDiagnostics['live']>): string {
    let input = 'physical keybinds  unavailable';
    try {
      input = this.inputProvider?.() ?? input;
    } catch {
      /* Keep explicit unavailable status. */
    }
    const common = `${input}\n${this.acknowledgements.format()}\nself course packet  ${this.age(this.lastSelfCourseAt)}   fresh accepted  ${this.age(this.lastFreshCourseAt)}`;
    if (!this.raw || !live) return `${common}\nWaiting for a local player course...`;
    const { course, target } = live;
    const dx = target ? target.pos.x - course.pos.x : 0;
    const dy = target ? target.pos.y - course.pos.y : 0;
    const vx = target ? target.speed.x - course.speed.x : 0;
    const vy = target ? target.speed.y - course.speed.y : 0;
    const rotation = target
      ? (angleDifference(target.rotation, course.rotation) * 180) / Math.PI
      : 0;
    return (
      (target ? 'magenta: active correction target\n' : 'correction target: none\n') +
      `pos Δ  ${dx.toFixed(2)}, ${dy.toFixed(2)}  (${Math.hypot(dx, dy).toFixed(2)})\n` +
      `vel Δ  ${vx.toFixed(2)}, ${vy.toFixed(2)}\nrot Δ  ${rotation.toFixed(2)}°\n${common}\n` +
      `keys raw/target/local  ${headingKeys(this.raw)} / ${target ? headingKeys(target) : 'none'} / ${headingKeys(course)}\n` +
      `raw simulation age  ${(course.time - this.raw.time).toFixed(0)} ms\nlast packet  ${this.action}`
    );
  }

  private age(at: number): string {
    return at === 0 ? 'none' : `${Math.max(0, this.now() - at)} ms ago`;
  }
}
