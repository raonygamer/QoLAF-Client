import type { MovementCommand } from './MovementReplay';

export interface RemoteMovementState {
  accelerate: boolean;
  deaccelerate: boolean;
}
interface Snapshot extends RemoteMovementState {
  time: number;
  applyAt: number;
}

/** Original 66ms ordered playback for remote thrust/braking, independent of extrapolated targets. */
export class RemoteMovementBuffer {
  private snapshots: Snapshot[] = [];
  private latestServerTime = -Infinity;
  private lastNow = NaN;
  private sampled: RemoteMovementState = { accelerate: false, deaccelerate: false };

  reset(): void {
    this.snapshots.length = 0;
    this.latestServerTime = -Infinity;
    this.lastNow = NaN;
    this.sampled.accelerate = this.sampled.deaccelerate = false;
  }

  addHeading(heading: RemoteMovementState & { time: number }, receivedAt: number): boolean {
    if (!heading || !Number.isFinite(heading.time)) return false;
    return this.append(heading.time, heading.accelerate, heading.deaccelerate, receivedAt);
  }

  addCommand(command: MovementCommand, receivedAt: number): boolean {
    if (
      !command ||
      !Number.isFinite(command.time) ||
      ![0, 8, 4].includes(command.type) ||
      !this.snapshots.length
    )
      return false;
    // Consumed stale commands must not fall back to immediate native application.
    if (command.time < this.latestServerTime) return true;
    const previous = this.snapshots[this.snapshots.length - 1];
    let { accelerate, deaccelerate } = previous;
    if (command.type === 0) accelerate = command.active;
    else if (command.type === 8) deaccelerate = command.active;
    else if (command.active) {
      accelerate = true;
      deaccelerate = false;
    }
    return this.append(command.time, accelerate, deaccelerate, receivedAt);
  }

  private append(
    time: number,
    accelerate: boolean,
    deaccelerate: boolean,
    receivedAt: number,
  ): boolean {
    if (time < this.latestServerTime) return false;
    const previous = this.snapshots.at(-1);
    let applyAt = Number.isFinite(receivedAt)
      ? receivedAt + (previous ? 66 : 0)
      : Number.isFinite(this.lastNow)
        ? this.lastNow
        : 0;
    if (
      previous &&
      (time === previous.time ||
        (previous.accelerate === accelerate && previous.deaccelerate === deaccelerate))
    ) {
      applyAt = previous.applyAt;
      this.snapshots[this.snapshots.length - 1] = { time, applyAt, accelerate, deaccelerate };
    } else {
      if (previous) applyAt = Math.max(applyAt, previous.applyAt);
      this.snapshots.push({ time, applyAt, accelerate, deaccelerate });
      if (this.snapshots.length > 32) this.snapshots.shift();
    }
    this.latestServerTime = time;
    if (!previous) {
      this.sampled.accelerate = accelerate;
      this.sampled.deaccelerate = deaccelerate;
      if (Number.isFinite(receivedAt)) this.lastNow = receivedAt;
    }
    return true;
  }

  sample(now: number): RemoteMovementState | null {
    if (!this.snapshots.length) return null;
    if (!Number.isFinite(now)) return this.sampled;
    const elapsed = now - this.lastNow;
    if (Number.isFinite(this.lastNow) && (elapsed < 0 || elapsed > 500)) {
      const newest = this.snapshots[this.snapshots.length - 1];
      newest.applyAt = now;
      this.snapshots = [newest];
    }
    this.lastNow = now;
    let selected = this.snapshots[0];
    for (let index = 1; index < this.snapshots.length; index++) {
      if (now < this.snapshots[index].applyAt) break;
      selected = this.snapshots[index];
    }
    this.sampled.accelerate = selected.accelerate;
    this.sampled.deaccelerate = selected.deaccelerate;
    while (this.snapshots.length > 1 && now >= this.snapshots[1].applyAt) this.snapshots.shift();
    return this.sampled;
  }
}
