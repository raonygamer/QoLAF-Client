/** Read-only render coordinates used by the original Skeletor Lightning hysteresis. */
export interface BeamVisualUnit {
  alive: boolean;
  renderX: number;
  renderY: number;
  renderRotation: number;
  collisionRadius: number;
}

export interface BeamVisualSnapshot<T extends BeamVisualUnit> {
  name: string;
  time: number;
  firing: boolean;
  unit: T | null;
  target: T | null;
  secondaryTargets: readonly T[];
  range: number;
  angleVariance: number;
}

/** Presentation history only; never writes simulation targets or damage state. */
export class BeamVisualContinuity<T extends BeamVisualUnit> {
  static readonly grace = 5 * 33;
  static readonly aimHysteresis = (3 * 0.75) / 33;
  private target: T | null = null;
  private targetGraceEnd = 0;
  private secondary: T[] = [];
  private secondaryGraceEnd = 0;
  private stopEnd = 0;

  clear(): void {
    this.target = null;
    this.targetGraceEnd = this.secondaryGraceEnd = this.stopEnd = 0;
    this.secondary.length = 0;
  }

  /** Mirrors the source fire setter's visual hold, independently of its fire flag. */
  setFiring(snapshot: BeamVisualSnapshot<T>, firing: boolean, drawing: boolean): boolean {
    if (firing) {
      const continuing = this.stopEnd > 0 && drawing;
      this.stopEnd = 0;
      return continuing;
    }
    if (
      snapshot.name === 'Skeletor Lightning' &&
      drawing &&
      (snapshot.target?.alive || this.target?.alive)
    ) {
      if (!this.target && snapshot.target?.alive) this.target = snapshot.target;
      this.stopEnd = snapshot.time + BeamVisualContinuity.grace;
      return true;
    }
    this.clear();
    return false;
  }

  stopExpired(time: number, firing: boolean): boolean {
    return this.stopEnd > 0 && !firing && time >= this.stopEnd;
  }

  resolveTarget(snapshot: BeamVisualSnapshot<T>): T | null {
    if (snapshot.target?.alive) {
      this.target = snapshot.target;
      this.targetGraceEnd = 0;
      return snapshot.target;
    }
    if (snapshot.name !== 'Skeletor Lightning' || !this.target?.alive) {
      this.target = null;
      this.targetGraceEnd = 0;
      return null;
    }
    if (snapshot.firing && this.canRetain(snapshot, this.target)) {
      this.targetGraceEnd = 0;
      return this.target;
    }
    if (this.targetGraceEnd === 0) this.targetGraceEnd = snapshot.time + BeamVisualContinuity.grace;
    if (snapshot.time <= this.targetGraceEnd || this.stopEnd > 0) return this.target;
    this.target = null;
    this.targetGraceEnd = 0;
    return null;
  }

  canRetain(snapshot: BeamVisualSnapshot<T>, target: T | null): boolean {
    const unit = snapshot.unit;
    if (!target?.alive || !unit) return false;
    const x = target.renderX - unit.renderX;
    const y = target.renderY - unit.renderY;
    const distance = Math.sqrt(x * x + y * y);
    if (distance > snapshot.range + target.collisionRadius + 8) return false;
    const radiusAngle =
      distance > 0 && target.collisionRadius > 0
        ? Math.asin(Math.min(1, target.collisionRadius / distance))
        : 0;
    let angle = unit.renderRotation - Math.atan2(y, x);
    if (angle > Math.PI) angle -= 2 * Math.PI;
    else if (angle < -Math.PI) angle += 2 * Math.PI;
    return (
      Math.abs(angle) <= snapshot.angleVariance + BeamVisualContinuity.aimHysteresis + radiusAngle
    );
  }

  resolveSecondary(snapshot: BeamVisualSnapshot<T>): readonly T[] {
    if (snapshot.name !== 'Skeletor Lightning') return snapshot.secondaryTargets;
    if (snapshot.secondaryTargets.length > 0) {
      this.secondary = snapshot.secondaryTargets.filter((target) => target?.alive);
      this.secondaryGraceEnd = 0;
      return this.secondary;
    }
    this.secondary = this.secondary.filter((target) => target?.alive);
    if (this.secondary.length === 0) {
      this.secondaryGraceEnd = 0;
      return this.secondary;
    }
    if (this.secondaryGraceEnd === 0)
      this.secondaryGraceEnd = snapshot.time + BeamVisualContinuity.grace;
    if (snapshot.time <= this.secondaryGraceEnd || this.stopEnd > 0) return this.secondary;
    this.secondary.length = 0;
    this.secondaryGraceEnd = 0;
    return this.secondary;
  }
}
