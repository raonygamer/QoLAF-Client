/** Original PvP roster recovery: 2s initial delay, 1.5x backoff, 10s cap. */
export class RosterRetry {
  private delay = 2000;
  requested(now: number): number {
    const next = now + this.delay;
    this.delay = Math.min(10000, this.delay * 1.5);
    return next;
  }
  received(now: number, complete: boolean): number {
    const next = now + this.delay;
    if (complete) this.delay = 2000;
    return next;
  }
}
