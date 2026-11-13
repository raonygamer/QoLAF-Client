import type { ResponseSamples } from '../network/ResponseSamples';

/** Original foreground-only timeout, independent of simulation/server time. */
export class ClockResponseWatchdog {
  private activeSince = NaN;
  private lastFrame = NaN;
  private seenSequence = 0;
  private triggered = false;

  reset(sequence: number): void {
    this.activeSince = this.lastFrame = NaN;
    this.seenSequence = sequence;
  }

  update(active: boolean, samples: ResponseSamples, now = performance.now()): boolean {
    if (!active) {
      this.reset(samples.sequence);
      return false;
    }
    if (this.triggered) return false;
    if (Number.isFinite(this.lastFrame) && (now < this.lastFrame || now - this.lastFrame > 500)) {
      this.reset(samples.sequence);
    }
    this.lastFrame = now;
    if (!Number.isFinite(this.activeSince)) {
      this.activeSince = now;
      this.seenSequence = samples.sequence;
      return false;
    }
    let overdue = false;
    if (samples.sequence !== this.seenSequence) {
      this.seenSequence = samples.sequence;
      overdue =
        samples.receivedAt <= now &&
        samples.receivedAt - Math.max(samples.sentAt, this.activeSince) >= 10000;
    }
    const pending = samples.pendingSince;
    if (Number.isFinite(pending) && pending <= now) {
      overdue ||= now - Math.max(pending, this.activeSince) >= 10000;
    }
    if (!overdue) return false;
    this.triggered = true;
    return true;
  }
}
