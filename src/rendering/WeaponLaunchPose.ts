import type { Projectile } from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';

/** Capture the displayed muzzle once. Detached shots keep their fired world direction. */
export function weaponLaunchOffset(p: Projectile) {
  const ship: RenderedGameObject | null = p.unit;
  const mount = p.unit?.weaponPos;
  if (
    !mount ||
    !ship?.hasRenderPosition ||
    !ship.get_renderRotation ||
    !ship.get_renderX ||
    !ship.get_renderY ||
    !p.weapon
  )
    return;
  const pos = ship.get_pos();
  const dx = p.course.pos.x - pos.x;
  const dy = p.course.pos.y - pos.y;
  const reach = Math.hypot(
    Math.abs(mount.x + p.weapon.positionOffsetX) + Math.abs(p.weapon.positionXVariance),
    Math.abs(mount.y) + Math.abs(p.weapon.multiOffset) + Math.abs(p.weapon.positionYVariance),
  );
  // Resumed and secondary projectiles can originate far from the firing mount.
  if (!(Math.hypot(dx, dy) <= reach + Math.max(1, ship.get_radius()))) return;
  const delta = ship.get_renderRotation() - ship.get_rotation();
  const rotation = Math.atan2(Math.sin(delta), Math.cos(delta));
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return {
    x: ship.get_renderX() - pos.x + dx * (c - 1) - dy * s,
    y: ship.get_renderY() - pos.y + dx * s + dy * (c - 1),
    rotation,
    time: p.course.time,
  };
}
export type WeaponLaunchOffset = NonNullable<ReturnType<typeof weaponLaunchOffset>>;
