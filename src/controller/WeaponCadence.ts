/** Observed native projectile volleys, not held fire input or individual pellets. */
export class WeaponCadence {
  private lastShot = -Infinity;
  private interval = 0;

  shot(now: number, nominalInterval: number): void {
    const elapsed = now - this.lastShot;
    if (elapsed <= 1) return;
    // Ignore a pause between trigger presses when estimating the automatic cadence.
    this.interval =
      elapsed > 0 && elapsed < Math.max(250, nominalInterval * 2)
        ? elapsed
        : Math.max(17, nominalInterval);
    this.lastShot = now;
  }

  sample(now: number, nominalInterval: number): { interval: number; firing: boolean } {
    const interval = this.interval || Math.max(17, nominalInterval);
    return {
      interval,
      firing:
        now - this.lastShot <
        (nominalInterval >= 250 ? 70 : Math.min(150, Math.max(70, interval * 1.5))),
    };
  }
}
