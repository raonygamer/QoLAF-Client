/** Incoming damage per second relative to the ship's total effective health pool. */
export class DamageRumble {
  private hits: { time: number; fraction: number }[] = [];
  record(now: number, damage: number, maximum: number): void {
    if (damage > 0 && maximum > 0 && Number.isFinite(damage / maximum))
      this.hits.push({ time: now, fraction: damage / maximum });
  }
  intensity(now: number): number {
    this.hits = this.hits.filter((hit) => now - hit.time < 1000);
    if (!this.hits.length) return 0;
    const fractionPerSecond = this.hits.reduce((sum, hit) => sum + hit.fraction, 0);
    const age = now - this.hits[this.hits.length - 1].time;
    const fade = Math.max(0, Math.min(1, (600 - age) / 400));
    return Math.min(1, Math.max(0.05, Math.sqrt(fractionPerSecond / 0.25))) * fade;
  }
  clear(): void {
    this.hits = [];
  }
}
