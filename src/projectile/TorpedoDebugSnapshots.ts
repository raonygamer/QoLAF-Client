import type { Heading, PlayerShip, Projectile, Weapon } from '../game/Bindings';
import type { DiagnosticProjectile } from '../game/ProjectileDiagnostics';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import type { TorpedoDebugPhysics } from './TorpedoDebugProjection';
import type { TorpedoDebugPose } from './TorpedoDebugTracker';
import type { TorpedoTickPlayer } from './TorpedoDebugHistory';

export const torpedoDebugWeaponKey = 'C2C794A3-76BA-896F-689D-B94C77139DF4';

export function matchesDebugTorpedo(
  projectile: Projectile | null | undefined,
): projectile is Projectile {
  return !!projectile && projectile.isEnemy && projectile.weapon?.key === torpedoDebugWeaponKey;
}

/** Copy every heading component before native course application mutates it. */
export function torpedoHeadingSnapshot(heading: Heading | null) {
  if (!heading) return null;
  return {
    time: heading.time,
    x: heading.pos.x,
    y: heading.pos.y,
    vx: heading.speed.x,
    vy: heading.speed.y,
    rotation: heading.rotation,
    accelerate: heading.accelerate,
    deaccelerate: heading.deaccelerate,
    rotateLeft: heading.rotateLeft,
    rotateRight: heading.rotateRight,
  };
}

type PlayerCourseReceipt = {
  raw: ReturnType<typeof torpedoHeadingSnapshot>;
  receivedAt: number;
};

export function torpedoWeaponPhysics(weapon: Weapon, speed: number): TorpedoDebugPhysics {
  return {
    acceleration: weapon.acceleration,
    speedMax: speed,
    friction: weapon.friction,
    useShipSystem: weapon.useShipSystem,
    wave: false,
  };
}

export function torpedoProjectilePhysics(projectile: Projectile): TorpedoDebugPhysics | null {
  if (!projectile.weapon) return null;
  return {
    ...torpedoWeaponPhysics(projectile.weapon, projectile.speedMax),
    acceleration: projectile.acceleration,
    useShipSystem: projectile.useShipSystem,
    wave: projectile.wave,
  };
}

export function torpedoProjectilePose(projectile: DiagnosticProjectile): TorpedoDebugPose {
  const course = projectile.course;
  const clip = projectile.get_movieClip();
  const position = projectile.get_pos();
  return {
    id: projectile.get_id(),
    x: course.pos.x,
    y: course.pos.y,
    renderX: clip ? clip.get_x() : position.x,
    renderY: clip ? clip.get_y() : position.y,
    vx: course.speed.x,
    vy: course.speed.y,
    courseTime: course.time,
    rotation: course.rotation,
    radius: projectile.collisionRadius,
    ttl: projectile.ttl,
    alive: projectile.alive,
    visible: projectile.isVisible,
    onCanvas: projectile.isAddedToCanvas,
    corrected: projectile.get_usesServerBulletCourse?.() ?? false,
    errorX: projectile.error?.x ?? 0,
    errorY: projectile.error?.y ?? 0,
    convergenceCounter: projectile.convergenceCounter,
    convergenceTime: projectile.convergenceTime,
    oldX: projectile.oldPos.x,
    oldY: projectile.oldPos.y,
    shooterId: projectile.unit?.get_id() ?? -1,
    renderedCourseTime: projectile.get_renderedCourseTime?.() ?? NaN,
  };
}

/** Original bounded per-player raw-course store; replacement does not change FIFO order. */
export class TorpedoDebugPlayerSnapshots {
  private readonly receipts = new Map<string, PlayerCourseReceipt>();

  observe(id: string, heading: Heading | null, localMs: number): PlayerCourseReceipt {
    if (!this.receipts.has(id) && this.receipts.size >= 64) {
      const oldest = this.receipts.keys().next();
      if (!oldest.done) this.receipts.delete(oldest.value);
    }
    const receipt = { raw: torpedoHeadingSnapshot(heading), receivedAt: localMs >>> 0 };
    this.receipts.set(id, receipt);
    return receipt;
  }

  snapshot(ship: PlayerShip, serverEstimateMs: number, localMs: number, frameAlpha: number) {
    const player = ship.player;
    const receipt = player ? (this.receipts.get(player.id) ?? null) : null;
    const position = ship.get_pos();
    const course = torpedoHeadingSnapshot(ship.get_course());
    const rendered: RenderedGameObject = ship;
    return {
      id: player?.id ?? '',
      name: player ? player.get_name() : ship.get_name(),
      isMe: player?.isMe ?? false,
      x: position.x,
      y: position.y,
      renderX: rendered.get_renderX?.() ?? position.x,
      renderY: rendered.get_renderY?.() ?? position.y,
      radius: ship.collisionRadius,
      vx: course?.vx ?? NaN,
      vy: course?.vy ?? NaN,
      course,
      latestServerSnapshot: receipt,
      hp: ship.hp,
      shield: ship.shieldHp,
      alive: ship.alive,
      invulnerable: ship.invulnerable,
      rawAgeMs: receipt?.raw ? serverEstimateMs - receipt.raw.time : NaN,
      rawReceiptAgeMs: receipt ? (localMs - receipt.receivedAt) >>> 0 : NaN,
      renderTimeEstimateMs: course ? course.time + 33 * frameAlpha : NaN,
    };
  }

  nearby(
    ships: readonly PlayerShip[],
    x: number,
    y: number,
    serverEstimateMs: number,
    localMs: number,
    frameAlpha: number,
  ) {
    const result: (ReturnType<TorpedoDebugPlayerSnapshots['snapshot']> & { distance: number })[] =
      [];
    for (const ship of ships) {
      if (!ship || !ship.alive || !ship.get_course()) continue;
      const data = this.snapshot(ship, serverEstimateMs, localMs, frameAlpha);
      const dx = data.x - x;
      const dy = data.y - y;
      result.push({ ...data, distance: dx * dx + dy * dy });
    }
    result.sort((left, right) => left.distance - right.distance);
    return result.slice(0, 6);
  }

  reset(): void {
    this.receipts.clear();
  }
}

export type TorpedoDebugPlayerSnapshot = ReturnType<TorpedoDebugPlayerSnapshots['snapshot']>;

export function torpedoPlayerTick(snapshot: TorpedoDebugPlayerSnapshot): TorpedoTickPlayer | null {
  const course = snapshot.course;
  if (!course) return null;
  return [
    snapshot.id,
    snapshot.x,
    snapshot.y,
    snapshot.vx,
    snapshot.vy,
    course.time,
    course.rotation,
    snapshot.radius,
    snapshot.hp,
    snapshot.shield,
    snapshot.renderX,
    snapshot.renderY,
    snapshot.invulnerable,
    course.accelerate,
    course.deaccelerate,
    course.rotateLeft,
    course.rotateRight,
  ];
}
