import type { Projectile, GameScene } from '../game/Bindings';
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

const frameTimes = new WeakMap<GameScene, number>();

export function projectileRenderTime(game: GameScene): number {
  return frameTimes.get(game) ?? networkTime(game);
}

/** One render timestamp and one shared per-life eligibility decision. */
export class TorpedoFrames {
  private enabled = new WeakSet<Projectile>();

  capture(projectile: Projectile, enabled: boolean): void {
    this.reset(projectile);
    if (enabled) this.enabled.add(projectile);
  }

  reset(projectile: Projectile): void {
    this.enabled.delete(projectile);
  }

  beginFrame(game: GameScene): void {
    // SceneBase.getServerTime writes g.time. The source observer reads the
    // clock directly so rendering cannot change the simulation's tick time.
    frameTimes.set(game, networkTime(game));
  }

  capturedSetting(projectile: Projectile): boolean {
    return this.enabled.has(projectile);
  }

  usesServerCourse(projectile: Projectile): boolean {
    return (
      this.enabled.has(projectile) &&
      projectile.isEnemy &&
      projectile.ai === 'bullet' &&
      !projectile.wave &&
      projectile.weapon?.key === xhersixTorpedoWeaponKey
    );
  }

  seconds(projectile: Projectile, fallback: number): number {
    if (!this.usesServerCourse(projectile)) return fallback;
    const offset = projectileOffsetSeconds(
      projectileRenderTime(projectile.g),
      projectile.course.time,
      250,
    );
    return Number.isFinite(offset) ? offset : 0;
  }
}
