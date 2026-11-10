/** Original fixed-memory five-second estimate, in 50ms buckets. */
export class RollingDamageEstimate {
  private readonly amounts = new Float64Array(100);
  private readonly times = new Float64Array(100).fill(-1);
  private lastTime = -1;
  private partialTime = -1;

  record(amount: number, now: number): void {
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(now) || now < 0) return;
    this.updateClock(now);
    const time = Math.floor(now / 50) * 50;
    const slot = (time / 50) % 100;
    if (this.times[slot] !== time) {
      this.times[slot] = time;
      this.amounts[slot] = 0;
    }
    this.amounts[slot] += amount;
  }

  perSecond(now: number): number {
    if (!Number.isFinite(now) || now < 0) return 0;
    this.updateClock(now);
    let total = 0;
    for (let i = 0; i < 100; i++)
      if (this.times[i] > now - 5000 && this.times[i] <= now) total += this.amounts[i];
    return total / 5;
  }

  markPartial(now: number): void {
    if (!Number.isFinite(now) || now < 0) return;
    this.updateClock(now);
    this.partialTime = now;
  }

  isPartial(now: number): boolean {
    if (!Number.isFinite(now) || now < 0) return false;
    this.updateClock(now);
    return this.partialTime >= 0 && now - this.partialTime < 5000;
  }

  reset(): void {
    this.lastTime = this.partialTime = -1;
    this.amounts.fill(0);
    this.times.fill(-1);
  }

  private updateClock(now: number): void {
    if (now < this.lastTime) this.reset();
    this.lastTime = now;
  }
}
