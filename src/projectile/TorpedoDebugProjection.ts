export type TorpedoDebugHeading = {
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  accelerate?: boolean;
  deaccelerate?: boolean;
  rotateLeft?: boolean;
  rotateRight?: boolean;
};

export type TorpedoDebugPhysics = {
  acceleration: number;
  speedMax: number;
  friction: number;
  useShipSystem: boolean;
  wave: boolean;
};

export type TorpedoDebugProjectionResult = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  time: number;
  targetTime: number;
  steps: number;
  valid: boolean;
  reason: string;
};

/** Independent replay for diagnostics only. Never writes a live heading or collision state. */
export class TorpedoDebugProjection {
  static project(
    raw: Readonly<TorpedoDebugHeading> | null,
    physics: Readonly<TorpedoDebugPhysics> | null,
    targetTime: number,
  ): TorpedoDebugProjectionResult {
    if (!raw || !physics) return this.invalid(targetTime, 'missing snapshot');
    try {
      const finite = (value: number, maximum: number) =>
        typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= maximum;
      if (
        !finite(raw.time, 1e15) ||
        !finite(targetTime, 1e15) ||
        ![raw.x, raw.y, raw.vx, raw.vy, raw.rotation].every((value) => finite(value, 1e12))
      )
        return this.invalid(targetTime, 'invalid snapshot');
      if (
        ![physics.acceleration, physics.speedMax, physics.friction].every(
          (value) => finite(value, 1e12) && value >= 0,
        ) ||
        typeof physics.useShipSystem !== 'boolean' ||
        typeof physics.wave !== 'boolean'
      )
        return this.invalid(targetTime, 'invalid physics');
      if (physics.wave) return this.invalid(targetTime, 'wave not supported');
      const elapsed = targetTime - raw.time;
      if (elapsed < 0) return this.invalid(targetTime, 'future snapshot');
      if (elapsed > 20000) return this.invalid(targetTime, 'snapshot too old');
      let { x, y, vx, vy, time } = raw;
      let steps = 0;
      const { acceleration, speedMax, friction, useShipSystem } = physics;
      const ax = Math.cos(raw.rotation) * acceleration * (33 * 33 * 0.5);
      const ay = Math.sin(raw.rotation) * acceleration * (33 * 33 * 0.5);
      while (time < targetTime && steps < 607) {
        // Preserve the original Projectile.updateHeading operation order.
        if (!useShipSystem) {
          if (acceleration !== 0) {
            const nextVx = vx + ax;
            const nextVy = vy + ay;
            if (nextVx * nextVx + nextVy * nextVy <= speedMax * speedMax) {
              vx = nextVx;
              vy = nextVy;
            } else {
              const length = Math.sqrt(nextVx * nextVx + nextVy * nextVy);
              vx = (speedMax * nextVx) / length;
              vy = (speedMax * nextVy) / length;
            }
          }
          vx -= friction * vx + 0.009 * vx;
          vy -= friction * vy + 0.009 * vy;
        }
        x += 0.001 * vx * 33;
        y += 0.001 * vy * 33;
        const nextTime = time + 33;
        if (
          nextTime <= time ||
          !finite(nextTime, 1e15) ||
          ![x, y, vx, vy].every((value) => finite(value, 1e12))
        )
          return this.invalid(targetTime, 'replay overflow');
        time = nextTime;
        steps++;
      }
      if (time < targetTime) return this.invalid(targetTime, 'replay limit');
      x += 0.001 * vx * (targetTime - time);
      y += 0.001 * vy * (targetTime - time);
      if (!finite(x, 1e12) || !finite(y, 1e12))
        return this.invalid(targetTime, 'interpolation overflow');
      return { x, y, vx, vy, time, targetTime, steps, valid: true, reason: '' };
    } catch {
      return this.invalid(targetTime, 'unreadable snapshot');
    }
  }

  private static invalid(targetTime: number, reason: string): TorpedoDebugProjectionResult {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      time: 0,
      targetTime: Number.isFinite(targetTime) ? targetTime : 0,
      steps: 0,
      valid: false,
      reason,
    };
  }
}
