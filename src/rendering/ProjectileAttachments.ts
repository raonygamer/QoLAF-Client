import type { RenderedGameObject } from '../game/RenderedGameObject';
import type { MissileStuck, Projectile, ProjectileStuck, Unit } from '../game/Bindings';

type RenderedUnit = Unit & RenderedGameObject;

/** Projectile.drawAttachedTo: rotate the tick-owned contact around the displayed host. */
export function drawAttachedProjectile(
  projectile: Projectile,
  host: RenderedUnit | null,
  offsetX = 0,
  offsetY = 0,
): void {
  const clip = projectile._mc;
  if (!host?.alive || !clip) return;
  const position = host.get_pos();
  const rotation = host.get_rotation();
  const delta = (host.get_renderRotation?.() ?? rotation) - rotation;
  const dx = projectile.course.pos.x + offsetX - position.x;
  const dy = projectile.course.pos.y + offsetY - position.y;
  const cosine = Math.cos(delta);
  const sine = Math.sin(delta);
  clip.set_x((host.get_renderX?.() ?? position.x) + dx * cosine - dy * sine);
  clip.set_y((host.get_renderY?.() ?? position.y) + dx * sine + dy * cosine);
  clip.set_rotation(projectile.get_rotation() + delta);
}

/** MissileStuck.draw adds only the remaining fractional convergence correction. */
export function drawProjectileAttachment(
  state: MissileStuck | ProjectileStuck,
  missile: boolean,
): void {
  const projectile = state.p;
  const accumulator = projectile.g.gameStateMachine?.accumulator ?? 0;
  const alpha = Math.max(0, Math.min(1, accumulator / 33));
  const error = projectile.error;
  const correction =
    missile && error && projectile.convergenceTime > 0
      ? Math.min(alpha, Math.max(0, projectile.convergenceTime - projectile.convergenceCounter)) /
        projectile.convergenceTime
      : 0;
  drawAttachedProjectile(
    projectile,
    state.stuckUnit,
    error && correction > 0 ? -error.x * correction : 0,
    error && correction > 0 ? -error.y * correction : 0,
  );
}
