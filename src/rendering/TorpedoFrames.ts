import type { Raw } from '../api/Types';
import { networkTime } from './NetworkTime';
import { xhersixTorpedoWeaponKey } from '../projectile/XhersixTorpedoCue';

/** XhersixTorpedoTimeline.projectOffsetSeconds: signed, bounded display time. */
export function projectileOffsetSeconds(target: number, course: number, limit: number): number {
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(course) ||
    !Number.isFinite(limit) ||
    Math.abs(target) > 1e15 ||
    Math.abs(course) > 1e15 ||
    limit < 0 ||
    limit > 1e7
  )
    return NaN;
  const offset = target - course;
  return Math.abs(offset) <= limit ? offset * 0.001 : NaN;
}

/** Presentation only: the current game's course, collision and TTL stay native. */
export class TorpedoFrames {
  private enabled = new WeakSet<Raw>();
  private frameTime = new WeakMap<Raw, number>();

  capture(projectile: Raw, enabled: boolean): void {
    this.reset(projectile);
    if (enabled) this.enabled.add(projectile);
  }

  reset(projectile: Raw): void {
    this.enabled.delete(projectile);
  }

  beginFrame(game: Raw): void {
    // SceneBase.getServerTime writes g.time. The source observer reads the
    // clock directly so rendering cannot change the simulation's tick time.
    this.frameTime.set(game, networkTime(game));
  }

  seconds(projectile: Raw, fallback: number): number {
    if (
      !this.enabled.has(projectile) ||
      !projectile.isEnemy ||
      projectile.ai !== 'bullet' ||
      projectile.wave ||
      projectile.weapon?.key !== xhersixTorpedoWeaponKey
    )
      return fallback;
    const offset = projectileOffsetSeconds(
      this.frameTime.get(projectile.g) ?? networkTime(projectile.g),
      projectile.course.time,
      250,
    );
    return Number.isFinite(offset) ? offset : 0;
  }
}
