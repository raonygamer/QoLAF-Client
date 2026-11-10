// Port of RadarTelemetryMetrics.as, including its cosmetic 10x speed convention.
export class Telemetry {
  fps = NaN;
  speed = NaN;
  private frames = 0;
  private seconds = 0;
  advance(dt: number, vx: number, vy: number, valid: boolean) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.frames++;
    this.seconds += dt;
    if (this.seconds >= 0.5) {
      this.fps = this.frames / this.seconds;
      this.frames = this.seconds = 0;
    }
    const speed = Math.hypot(vx, vy);
    if (!valid || !Number.isFinite(speed)) {
      this.speed = NaN;
      return;
    }
    this.speed = Number.isFinite(this.speed)
      ? this.speed + (speed - this.speed) * (1 - Math.exp(-dt / 0.12))
      : speed;
  }
  displaySpeed(mph: boolean) {
    return (this.speed * 36) / (mph ? 1.609344 : 1);
  }
}
