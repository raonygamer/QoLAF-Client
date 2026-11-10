import { read, type Raw } from '../api/Types';

/** Projectile.drawAttachedTo: rotate the tick-owned contact around the displayed host. */
export function drawAttachedProjectile(projectile: Raw, host: Raw, offsetX = 0, offsetY = 0): void {
  if (!host?.alive || !projectile._mc) return;
  const clip = host.isAddedToCanvas && host.hasRenderPosition !== false ? host._mc : null;
  const position = read(host, 'pos');
  const rotation = read(host, 'rotation');
  const delta = read(clip, 'rotation', rotation) - rotation;
  const dx = projectile.course.pos.x + offsetX - position.x;
  const dy = projectile.course.pos.y + offsetY - position.y;
  const cosine = Math.cos(delta);
  const sine = Math.sin(delta);
  projectile._mc.set_x(read(clip, 'x', position.x) + dx * cosine - dy * sine);
  projectile._mc.set_y(read(clip, 'y', position.y) + dx * sine + dy * cosine);
  projectile._mc.set_rotation(read(projectile, 'rotation') + delta);
}

/** MissileStuck.draw adds only the remaining fractional convergence correction. */
export function drawProjectileAttachment(state: Raw, missile: boolean): void {
  const p = state.p;
  const alpha = Math.max(0, Math.min(1, p.g.gameStateMachine.accumulator / 33));
  const correction =
    missile && p.error && p.convergenceTime > 0
      ? Math.min(alpha, Math.max(0, p.convergenceTime - p.convergenceCounter)) / p.convergenceTime
      : 0;
  drawAttachedProjectile(
    p,
    state.stuckUnit,
    correction > 0 ? -p.error.x * correction : 0,
    correction > 0 ? -p.error.y * correction : 0,
  );
}
