import { read, type Raw } from '../api/Types';

export interface AimAssistSettings {
  getAimAssistBoolean(key: string): boolean;
  getAimAssistNumber(key: string): number;
}

export interface AimAssistContact {
  unit: Raw;
  time: number;
}

export interface AimAssistTargetContext {
  current: Raw | null;
  locked: boolean;
  lastContact(weapon: Raw): Readonly<AimAssistContact> | undefined;
  isPlayer(unit: Raw): boolean;
  isTeleport(weapon: Raw): boolean;
  isBeam(weapon: Raw): boolean;
  isEnemyShip(unit: Raw): boolean;
}

export interface AimAssistEligibility {
  target: Raw | null;
  /** Kept for the source debug panel even when this candidate is rejected. */
  candidate: Raw | null;
  reason: string;
  hitAge: number;
  hitWindow: number;
  distance: number;
  minimumDistance: number;
}

/** PlayState.getAimAssistTarget, using confirmed native contacts from DamageObserver. */
export function selectAimAssistTarget(
  ship: Raw | null,
  weapon: Raw | null,
  now: number,
  settings: AimAssistSettings,
  context: AimAssistTargetContext,
): AimAssistEligibility {
  const result: AimAssistEligibility = {
    target: null,
    candidate: null,
    reason: '',
    hitAge: -1,
    hitWindow: -1,
    distance: NaN,
    minimumDistance: NaN,
  };
  const reject = (reason: string) => {
    result.reason = reason;
    return result;
  };
  const option = (name: string) => settings.getAimAssistBoolean('aim_assist_' + name);
  const number = (name: string) => settings.getAimAssistNumber('aim_assist_' + name);
  if (!ship) return reject('player ship unavailable');
  if (!weapon) return reject('no selected weapon');
  if (context.isTeleport(weapon)) return reject('teleport uses manual aim');
  if (context.isBeam(weapon)) return reject('beam weapons are excluded');
  if (read(weapon, 'isMissileWeapon')) return reject('missile weapons are excluded');
  if (!weapon.projectileFunction?.length) return reject('weapon has no projectile function');
  if (!read(weapon, 'fire')) return reject('selected weapon fire flag is false');

  const pinned = option('pin_locked_target') && context.locked ? context.current : null;
  const contact = pinned ? undefined : context.lastContact(weapon);
  const candidate = pinned ?? contact?.unit ?? null;
  result.candidate = candidate;
  if (!candidate) return reject('waiting for a locally simulated weapon hit');
  if (!pinned) {
    const minimumWindow = number('min_hit_window');
    const maximumWindow = Math.max(minimumWindow, number('max_hit_window'));
    result.hitAge = now - contact!.time;
    result.hitWindow = Math.trunc(
      Math.max(minimumWindow, Math.min(maximumWindow, read(weapon, 'reloadTime') * 2)),
    );
    if (result.hitAge < 0) return reject('simulated hit timestamp is in the future');
    if (result.hitAge > result.hitWindow) return reject('last simulated hit is too old');
  }
  if (context.isPlayer(candidate)) return reject('player targets are excluded');
  if (!candidate.alive) return reject(pinned ? 'locked target is dead' : 'last hit target is dead');
  if (!read(candidate, 'isHostile'))
    return reject(pinned ? 'locked target is not hostile' : 'last hit target is not hostile');
  if (!pinned && option('require_active_target')) {
    if (!context.current) return reject('there is no active target-system target');
    if (context.current !== candidate)
      return reject('simulated hit does not match the active target');
  }
  const origin = read(ship, 'pos');
  const position = read(candidate, 'pos');
  result.distance = Math.hypot(position.x - origin.x, position.y - origin.y);
  result.minimumDistance = Math.max(
    number('min_distance'),
    read(weapon, 'range') * number('min_range_ratio'),
  );
  if (result.distance < result.minimumDistance)
    return reject(
      pinned
        ? 'locked target is inside the minimum assist distance'
        : 'target is inside the minimum assist distance',
    );
  result.target = candidate;
  result.reason = pinned ? 'eligible pinned locked target' : 'eligible hit target';
  return result;
}

/** Source lead calculation, including orbit velocity and projectile lifetime limits. */
export function calculateProjectileAimAngle(
  ship: Raw,
  weapon: Raw,
  target: Raw,
  settings: AimAssistSettings,
  isEnemyShip: (unit: Raw) => boolean,
): number {
  const origin = read(ship, 'pos');
  const position = read(target, 'pos');
  const deltaX = position.x - origin.x;
  const deltaY = position.y - origin.y;
  const distance = Math.hypot(deltaX, deltaY);
  const direct = Math.atan2(deltaY, deltaX);
  const projectileSpeed = read(weapon, 'speed');
  if (
    !settings.getAimAssistBoolean('aim_assist_projectile_lead') ||
    distance <= 0 ||
    projectileSpeed <= 0
  )
    return direct;
  const velocity =
    isEnemyShip(target) && target.stateMachine.inState('AIOrbit')
      ? target.calculateOrbitSpeed()
      : read(target, 'speed');
  const closingSpeed = projectileSpeed - (velocity.x * deltaX + velocity.y * deltaY) / distance;
  if (closingSpeed <= 1) return direct;
  let leadTime = Math.min(
    settings.getAimAssistNumber('aim_assist_max_lead_time'),
    distance / closingSpeed,
  );
  const lifetime = read(weapon, 'ttl');
  if (lifetime > 0) leadTime = Math.min(leadTime, lifetime / 1000);
  return Math.atan2(deltaY + velocity.y * leadTime, deltaX + velocity.x * leadTime);
}
