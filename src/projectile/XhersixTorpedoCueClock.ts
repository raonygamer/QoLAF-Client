/** Source visual metronome. This clock never predicts or creates projectiles. */
export class XhersixTorpedoCueClock {
  active = false;
  ownerId = 0;
  pulse = false;
  phaseMs = NaN;
  remainingMs = NaN;
  cycle = 0;
  pulseAgeMs = NaN;
  private elapsed = 0;
  private lastSeen = 0;
  private lastClock = 0;
  private phaseOffset = 0;
  private pulseStartedAt = 0;

  reset(): void {
    this.active = false;
    this.ownerId = 0;
    this.pulse = false;
    this.phaseMs = this.remainingMs = this.pulseAgeMs = NaN;
    this.cycle =
      this.elapsed =
      this.lastSeen =
      this.lastClock =
      this.phaseOffset =
      this.pulseStartedAt =
        0;
  }
  observe(ownerId: number, now: number): void {
    this.sample(now);
    if (!this.active) {
      this.active = true;
      this.ownerId = ownerId;
      this.elapsed = this.lastSeen = 0;
      this.lastClock = now >>> 0;
      this.updatePhase();
    } else if (ownerId === this.ownerId) {
      this.lastSeen = this.elapsed;
      const drift = this.phaseMs <= 1250 ? this.phaseMs : this.phaseMs - 2500;
      if (Math.abs(drift) >= 50) {
        this.phaseOffset -= drift;
        this.updatePhase();
      }
    }
  }
  sample(now: number): void {
    if (!this.active) return;
    this.elapsed += (now - this.lastClock) >>> 0;
    this.lastClock = now >>> 0;
    if (this.elapsed - this.lastSeen > 3000) this.reset();
    else this.updatePhase();
  }
  private updatePhase(): void {
    const phaseTime = this.elapsed + this.phaseOffset;
    const cycle = Math.floor(phaseTime / 2500);
    this.phaseMs = phaseTime - cycle * 2500;
    if (cycle > this.cycle) this.pulseStartedAt = this.elapsed - this.phaseMs;
    this.cycle = cycle;
    this.pulseAgeMs = this.elapsed - this.pulseStartedAt;
    this.remainingMs = 2500 - this.phaseMs;
    this.pulse = this.pulseAgeMs < 350;
  }
  read(now: number) {
    this.sample(now);
    return {
      active: this.active,
      ownerId: this.ownerId,
      pulse: this.pulse,
      phaseMs: this.phaseMs,
      remainingMs: this.remainingMs,
      cycle: this.cycle,
    };
  }
}
