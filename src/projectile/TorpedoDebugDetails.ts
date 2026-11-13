import type { DiagnosticProjectile } from '../game/ProjectileDiagnostics';
import { DataLocator, PlayerShip, type Projectile } from '../game/Bindings';

type Scalar = string | number | boolean | null;
type Fields<K extends string> = { [P in K]: Scalar };

/** Bounded diagnostic reflection: optional/newer runtime fields become detached scalars. */
function read(value: unknown, field: string): unknown {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
  try {
    const getter: unknown = Reflect.get(value, `get_${field}`);
    if (typeof getter === 'function') return Reflect.apply(getter, value, []);
    return Reflect.get(value, field);
  } catch {
    return null;
  }
}
function scalar(value: unknown): Scalar {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, 160);
  return null;
}
function copy<K extends string>(value: object, fields: readonly K[]): Fields<K>;
function copy<K extends string>(value: unknown, fields: readonly K[]): Fields<K> | null;
function copy<K extends string>(value: unknown, fields: readonly K[]): Fields<K> | null {
  if (value == null) return null;
  // Every requested key is produced exactly once, with a scalar value.
  return Object.fromEntries(
    fields.map((field) => [field, scalar(read(value, field))]),
  ) as Fields<K>;
}
function length(value: unknown): number {
  const count = read(value, 'length');
  return typeof count === 'number' && Number.isFinite(count) && count >= 0 && count <= 0x7fffffff
    ? Math.trunc(count)
    : 0;
}
function scalars(value: unknown, limit: number) {
  const total = length(value);
  const items: Scalar[] = [];
  for (let index = 0; index < Math.min(total, limit); index++)
    items.push(scalar(read(value, String(index))));
  return { items, total, truncated: total > limit, limit };
}
function damage(value: unknown) {
  const fields = copy(value, ['type']);
  if (!fields) return null;
  let amount: Scalar = null;
  try {
    const sum = read(value, 'dmg');
    if (typeof sum === 'function') amount = scalar(Reflect.apply(sum, value, []));
  } catch {
    /* Unavailable damage totals remain null. */
  }
  return { ...fields, amount };
}
function list<K extends string>(value: unknown, fields: readonly K[], includeDamage = false) {
  const total = length(value);
  const items: (Fields<K> | (Fields<K> & { damage: ReturnType<typeof damage> }) | null)[] = [];
  for (let index = 0; index < Math.min(total, 16); index++) {
    const item = read(value, String(index));
    const entry = copy(item, fields);
    items.push(entry && includeDamage ? { ...entry, damage: damage(read(item, 'damage')) } : entry);
  }
  return { items, total, truncated: total > 16, limit: 16 };
}
function unit(value: unknown) {
  const fields = copy(value, [
    'id',
    'lifecycleId',
    'name',
    'type',
    'level',
    'alive',
    'active',
    'invulnerable',
    'collisionRadius',
    'team',
    'isHostile',
    'isBossUnit',
    'isAddedToCanvas',
  ]);
  if (!fields) return null;
  return {
    ...fields,
    runtimeClass: scalar(read(read(value, '__class__'), '__name__')),
    isPlayerShip: value instanceof PlayerShip,
    factions: scalars(read(value, 'factions'), 16),
  };
}
function cachedProjectile(key: unknown) {
  if (typeof key !== 'string' || !key || key.length > 160) return null;
  let data: unknown = null;
  try {
    data = DataLocator.getService().loadKey('Projectiles', key);
  } catch {
    /* Reads only the shipped/in-memory cache. */
  }
  const fields = copy(data, [
    'name',
    'ai',
    'collisionRadius',
    'wave',
    'waveAmplitude',
    'waveFrequency',
    'aiAlwaysExplode',
    'aiStuck',
    'aiStuckDuration',
    'aiTargetSelf',
    'aiDelayedAcceleration',
    'aiDelayedAccelerationTime',
  ]);
  return fields
    ? {
        ...fields,
        key,
        source:
          'Client Projectiles cache before runtime adjustments; NOT authoritative server values.',
      }
    : null;
}

/** Source event detail snapshots; these fields never confirm a server hit. */
export class TorpedoDebugDetails {
  static projectile(projectile: Projectile | null) {
    if (!projectile) return null;
    const diagnostic: DiagnosticProjectile = projectile;
    const fields = copy(projectile, [
      'id',
      'lifecycleId',
      'name',
      'ai',
      'alive',
      'isEnemy',
      'isHeal',
      'isBomb',
      'isVisible',
      'isAddedToCanvas',
      'collisionRadius',
      'dmgRadius',
      'numberOfHits',
      'ttl',
      'ttlMax',
      'range',
      'speedMax',
      'acceleration',
      'rotationSpeedMax',
      'useShipSystem',
      'wave',
      'waveDirection',
      'waveAmplitude',
      'waveFrequency',
      'aiAlwaysExplode',
      'aiStuck',
      'aiStuckDuration',
      'aiTargetSelf',
      'aiDelayedAcceleration',
      'aiDelayedAccelerationTime',
    ]);
    const weapon = read(projectile, 'weapon');
    const weaponFields = copy(weapon, [
      'key',
      'name',
      'type',
      'projectileFunction',
      'dmgRadius',
      'numberOfHits',
      'ttl',
      'range',
      'speed',
      'acceleration',
      'friction',
      'useShipSystem',
      'maxProjectiles',
      'multiNrOfP',
      'angleVariance',
      'reloadTime',
      'burst',
    ]);
    return {
      ...fields,
      serverBulletCourseEnabled: scalar(diagnostic.get_serverBulletCourseEnabled?.()),
      usesServerBulletCourse: scalar(diagnostic.get_usesServerBulletCourse?.()),
      serverBulletSpawnTime: scalar(diagnostic.get_serverBulletSpawnTime?.()),
      serverBulletLastCollisionTime: scalar(diagnostic.get_serverBulletLastCollisionTime?.()),
      renderedCourseTime: scalar(diagnostic.get_renderedCourseTime?.()),
      source: 'Client runtime values; collisionRadius/dmgRadius are not confirmed server hitboxes.',
      weapon: weaponFields
        ? {
            ...weaponFields,
            damage: damage(read(weapon, 'dmg')),
            debuffs: list(read(weapon, 'weaponDebuffs'), ['type', 'duration', 'effect'], true),
            debuffDurationUnit: 'seconds',
          }
        : null,
      cachedProjectile: cachedProjectile(read(weapon, 'projectileFunction')),
      owner: unit(read(projectile, 'unit')),
      target: unit(read(projectile, 'target')),
      targetProjectile: copy(read(projectile, 'targetProjectile'), [
        'id',
        'lifecycleId',
        'alive',
        'ai',
      ]),
      clientCollisionNote:
        'Bullet checks target alive, invulnerable and owner/faction routing; these fields alone do not confirm a hit.',
    };
  }

  static player(ship: PlayerShip | null) {
    if (!ship) return null;
    const identity = unit(ship);
    if (!identity) return null;
    const heading = read(ship, 'course');
    const courseTime = scalar(read(heading, 'time'));
    let boostActiveAtCourseTime: Scalar = null;
    if (typeof courseTime === 'number') {
      try {
        const activeAt = read(ship, 'isBoostActiveAt');
        if (typeof activeAt === 'function')
          boostActiveAtCourseTime = scalar(Reflect.apply(activeAt, ship, [courseTime]));
      } catch {
        /* This optional read-only client accessor may not be installed. */
      }
    }
    return {
      ...identity,
      source: 'Client runtime snapshot, not server collision/state confirmation.',
      player: copy(read(ship, 'player'), ['id', 'name', 'isMe', 'isLanded', 'activeSkin']),
      health: copy(ship, [
        'hp',
        'hpMax',
        'shieldHp',
        'shieldHpMax',
        'armorThreshold',
        'shieldRegen',
        'shieldRegenCounter',
        'shieldRegenDuration',
        'shieldRegenBonus',
        'hpRegen',
        'hpRegenCounter',
        'hpRegenDuration',
        'disableHealEndtime',
      ]),
      resistances: scalars(read(ship, 'resistances'), 5),
      engine: copy(read(ship, 'engine'), [
        'name',
        'alive',
        'speed',
        'acceleration',
        'rotationSpeed',
        'rotationMod',
      ]),
      movement: {
        ...copy(ship, [
          'usingBoost',
          'hasBoost',
          'boostBonus',
          'boostCD',
          'boostDuration',
          'boostNextRdy',
          'ticksOfBoost',
          'totalTicksOfBoost',
          'boostEndedLastTick',
          'slowDown',
          'slowDownEndtime',
          'landed',
          'isTeleporting',
          'forcedRotation',
          'forcedRotationSpeed',
          'forcedRotationAim',
          'forcedRotationAngle',
          'rollDir',
          'rollMod',
          'rollSpeed',
          'rollPassive',
        ]),
        clientStepMs: 33,
        clientFriction: 0.009,
        clientBrakeMultiplier: 0.9,
        boostActiveAtCourseTime,
        replayNote:
          'Snapshot only: timed inputs, boost confirmations and external gravity still need the event/world history.',
      },
      inputs: copy(heading, [
        'time',
        'rotation',
        'accelerate',
        'deaccelerate',
        'rotateLeft',
        'rotateRight',
        'roll',
      ]),
      defense: copy(ship, [
        'hasHardenedShield',
        'usingHardenedShield',
        'hardenMaxDmg',
        'hardenCD',
        'hardenDuration',
        'hardenNextRdy',
        'hardenEndTimer',
        'channelingEnd',
      ]),
      debuffs: list(read(ship, 'debuffs'), [
        'debuff',
        'duration',
        'startTime',
        'endTime',
        'stacks',
      ]),
      debuffDurationUnit: 'milliseconds',
    };
  }
}
