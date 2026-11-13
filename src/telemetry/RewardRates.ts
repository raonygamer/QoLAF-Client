/** Gross rewards earned this client session; inventory reloads and spending are not rewards. */
export class RewardRates {
  private xp = 0;
  private cargo = 0;
  private artifacts = 0;
  private recycled = 0;
  constructor(private readonly started: number) {}

  add(kind: 'xp' | 'cargo' | 'artifacts' | 'recycled', amount: number): void {
    if (Number.isFinite(amount) && amount > 0) this[kind] += amount;
  }

  perHour(now: number, includeRecycled: boolean): { xp: number; cargo: number; artifacts: number } {
    const factor = 3600000 / Math.max(1000, now - this.started);
    return {
      xp: this.xp * factor,
      cargo: this.cargo * factor,
      artifacts: (this.artifacts + (includeRecycled ? this.recycled : 0)) * factor,
    };
  }
}
