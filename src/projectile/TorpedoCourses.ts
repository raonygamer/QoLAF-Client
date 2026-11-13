import { installProjectileDiagnosticGetters } from '../game/ProjectileDiagnostics';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Heading,
  Projectile,
  ProjectileBullet,
  ProjectileManager,
  Ship,
  Util,
  type Unit,
  type GameScene,
  type Message,
} from '../game/Bindings';
import { projectileOffsetSeconds } from '../rendering/TorpedoFrames';
import { torpedoImpactFraction } from './TorpedoTimeline';

interface Timeline {
  spawnTime: number;
  lastCollisionTime: number;
}

// Explicit contacts override the legacy observers' last-candidate inference.
const contacts = new WeakMap<object, Unit>();
export type TorpedoContactSnapshot = {
  fromTime: number;
  toTime: number;
  fraction: number;
  impactTime: number;
  impactX: number;
  impactY: number;
  shotStartX: number;
  shotStartY: number;
  shotEndX: number;
  shotEndY: number;
  targetStartX: number;
  targetStartY: number;
  targetEndX: number;
  targetEndY: number;
  combinedRadius: number;
  note: string;
};
type ContactObserver = (
  projectile: Projectile,
  target: Unit,
  snapshot: TorpedoContactSnapshot,
) => void;
const contactObservers = new Set<ContactObserver>();

/** Observe the solved contact before its impact point is applied to the live pose. */
export function observeTorpedoContacts(observer: ContactObserver): () => void {
  contactObservers.add(observer);
  return () => {
    contactObservers.delete(observer);
  };
}

export function torpedoContact(projectile: object): Unit | undefined {
  return contacts.get(projectile);
}

export interface TorpedoCourseObserver {
  active(game: GameScene): boolean;
  before(projectile: Projectile, message: Message, offset: number, mode: number): void;
  after(projectile: Projectile): void;
}
const courseObservers = new Set<TorpedoCourseObserver>();
export function observeTorpedoCourses(observer: TorpedoCourseObserver): () => void {
  courseObservers.add(observer);
  return () => {
    courseObservers.delete(observer);
  };
}

function clearCorrection(projectile: Projectile): void {
  projectile.error = null;
  projectile.errorRot = 0;
  projectile.convergenceCounter = 0;
  projectile.convergenceTime = 0;
}

function advanceTo(projectile: Projectile, time: number): void {
  const course = projectile.course;
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(course.time) ||
    Math.abs(time - course.time) > 10000
  )
    return;
  for (let steps = 0; course.time < time && steps < 304; steps++) {
    projectile.oldPos.x = course.pos.x;
    projectile.oldPos.y = course.pos.y;
    const before = course.time;
    projectile.updateHeading(course);
    if (course.time <= before) break;
  }
}

function boostActiveAt(ship: Ship, time: number): boolean {
  const method: unknown = Reflect.get(ship, 'isBoostActiveAt');
  if (typeof method === 'function') {
    const active: unknown = method.call(ship, time);
    if (typeof active === 'boolean') return active;
  }
  return ship.get_usingBoost();
}

/** Original server-timed straight torpedo path, scoped by the per-life client option. */
export function installTorpedoCourses(
  api: API,
  enabled: (projectile: Projectile) => boolean,
  resetRenderRotation: (projectile: Projectile) => void,
): void {
  const reflection = new GameReflection(api);
  const timelines = new WeakMap<Projectile, Timeline>();
  installProjectileDiagnosticGetters(api, {
    get_serverBulletSpawnTime() {
      return timelines.get(this)?.spawnTime ?? NaN;
    },
    get_serverBulletLastCollisionTime() {
      return timelines.get(this)?.lastCollisionTime ?? NaN;
    },
  });
  const timeline = (projectile: Projectile): Timeline => {
    let value = timelines.get(projectile);
    if (!value) {
      value = { spawnTime: NaN, lastCollisionTime: NaN };
      timelines.set(projectile, value);
    }
    return value;
  };
  const adopt = (projectile: Projectile, heading: Heading): void => {
    const presentTime = projectile.course.time;
    if (
      ![
        presentTime,
        heading.time,
        heading.pos.x,
        heading.pos.y,
        heading.speed.x,
        heading.speed.y,
        heading.rotation,
      ].every(Number.isFinite) ||
      heading.time + 10000 < presentTime
    )
      return;
    for (let steps = 0; heading.time < presentTime && steps < 304; steps++)
      projectile.updateHeading(heading);
    if (
      heading.time < presentTime ||
      ![heading.pos.x, heading.pos.y, heading.speed.x, heading.speed.y].every(Number.isFinite)
    )
      return;
    projectile.course = heading;
    clearCorrection(projectile);
    timeline(projectile).lastCollisionTime = projectile.g.time;
    projectile.set_x(heading.pos.x);
    projectile.set_y(heading.pos.y);
    projectile.set_rotation(heading.rotation);
    resetRenderRotation(projectile);
  };

  reflection.before(Projectile.prototype, 'reset', function () {
    timelines.delete(this);
    contacts.delete(this);
  });
  reflection.around(Projectile.prototype, 'fastforward', function (next) {
    if (!enabled(this)) return next();
    const before = this.course.time;
    advanceTo(this, this.g.time);
    this.ttl -= this.course.time - before;
    this.set_x(this.course.pos.x);
    this.set_y(this.course.pos.y);
    this.set_rotation(this.course.rotation);
    timeline(this).lastCollisionTime = this.g.time;
  });
  reflection.around(
    ProjectileManager.prototype,
    'createSetProjectile',
    function (next, projectile, id, unit, heading, index, offsetX, offsetY, speed = 0) {
      if (!projectile || !enabled(projectile))
        return next(projectile, id, unit, heading, index, offsetX, offsetY, speed);
      projectile.set_id(id);
      if (Number.isFinite(speed) && speed !== 0) projectile.speedMax = speed;
      projectile.unit = unit;
      projectile.course = heading;
      timeline(projectile).spawnTime = heading.time;
      projectile.set_rotation(heading.rotation);
      projectile.collisionRadius *= 0.5;
      clearCorrection(projectile);
      projectile.fastforward();
      this.activateProjectile(projectile);
      projectile.weapon?.playFireSound();
    },
  );

  reflection.around(ProjectileManager.prototype, 'updateCourse', function (next, message) {
    let hasCorrection = false;
    let hasMissingProjectile = false;
    for (let index = 0; index < message.length; index += 14) {
      const projectile = this.projectilesById.h[String(message.getInt(index))];
      if (!projectile) {
        hasMissingProjectile = true;
        continue;
      }
      const kind = message.getInt(index + 1);
      if (enabled(projectile) && kind !== 0 && kind !== 1 && kind !== 2) hasCorrection = true;
    }
    const observers = [...courseObservers].filter((observer) => observer.active(this.g));
    if (!hasCorrection && !hasMissingProjectile && !observers.length) return next(message);
    // Preserve the native packet order, including mixed eligible/ordinary shots.
    for (let index = 0; index < message.length; index += 14) {
      const projectile = this.projectilesById.h[String(message.getInt(index))];
      // Removed or culled shots must not discard later records in the packet.
      if (!projectile) continue;
      const kind = message.getInt(index + 1);
      for (const observer of observers) {
        try {
          observer.before(projectile, message, index, kind);
        } catch {
          /* Diagnostics only. */
        }
      }
      const value = message.getNumber(index + 2) | 0;
      if (kind === 0) {
        projectile.direction = value;
        if (value > 0) {
          projectile.boomerangReturning = true;
          projectile.rotationSpeedMax = message.getNumber(index + 3);
        }
        if (value === 3)
          projectile.course.rotation = Util.clampRadians(projectile.course.rotation + Math.PI);
      } else if (kind === 1) {
        projectile.target = this.g.unitManager.getTarget(value);
        projectile.targetProjectile = null;
        const duration = message.getNumber(index + 3);
        if (duration > 0) {
          projectile.aiStuck = true;
          projectile.aiStuckDuration = duration | 0;
        }
      } else if (kind === 2) {
        projectile.aiStuck = false;
        projectile.target = null;
        projectile.targetProjectile = this.projectilesById.h[String(value)] ?? null;
      } else {
        if (kind === 3) {
          projectile.aiStuck = false;
          projectile.target = null;
          projectile.targetProjectile = null;
        }
        const heading = new Heading();
        heading.parseMessage(message, index + 4);
        if (enabled(projectile)) adopt(projectile, heading);
        else if (kind === 3) {
          // Native point clone retains its class and getter behavior.
          projectile.error = projectile.course.pos.clone();
          projectile.error.x -= heading.pos.x;
          projectile.error.y -= heading.pos.y;
          projectile.errorRot = Util.clampRadians(projectile.course.rotation - heading.rotation);
          if (projectile.errorRot > Math.PI) projectile.errorRot -= Math.PI * 2;
          projectile.convergenceCounter = 0;
          projectile.course = heading;
          projectile.convergenceTime = 15;
        } else {
          while (heading.time < projectile.course.time) projectile.updateHeading(heading);
          projectile.course = heading;
        }
      }
      for (const observer of observers) {
        try {
          observer.after(projectile);
        } catch {
          /* Diagnostics only. */
        }
      }
    }
  });

  reflection.around(ProjectileBullet.prototype, 'execute', function (next) {
    const projectile = this.p;
    if (!enabled(projectile)) return next();
    clearCorrection(projectile);
    advanceTo(projectile, this.m.time);
    const state = timeline(projectile);
    const now = this.m.time;
    let from = state.lastCollisionTime;
    state.lastCollisionTime = now;
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(now) ||
      now <= from ||
      now - from > 100 ||
      !Number.isFinite(state.spawnTime) ||
      now < state.spawnTime ||
      !projectile.unit ||
      !Number.isFinite(projectile.collisionRadius) ||
      projectile.collisionRadius <= 0
    )
      return;
    from = Math.max(from, state.spawnTime);
    const startOffset = projectileOffsetSeconds(from, projectile.course.time, 150);
    const endOffset = projectileOffsetSeconds(now, projectile.course.time, 150);
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return;
    const startX = projectile.course.pos.x + projectile.course.speed.x * startOffset;
    const startY = projectile.course.pos.y + projectile.course.speed.y * startOffset;
    const endX = projectile.course.pos.x + projectile.course.speed.x * endOffset;
    const endY = projectile.course.pos.y + projectile.course.speed.y * endOffset;
    const candidates = this.isEnemy ? this.m.shipManager.players : this.m.unitManager.units;
    let best: Unit | null = null;
    let bestFraction = Infinity;
    let bestStartX = 0;
    let bestStartY = 0;
    let bestEndX = 0;
    let bestEndY = 0;
    for (const candidate of candidates) {
      if (
        !candidate ||
        !candidate.alive ||
        candidate.invulnerable ||
        candidate === projectile.unit ||
        !Number.isFinite(candidate.collisionRadius) ||
        candidate.collisionRadius <= 0
      )
        continue;
      const position = candidate.get_pos();
      let targetStartX = position.x;
      let targetStartY = position.y;
      let targetEndX = position.x;
      let targetEndY = position.y;
      if (reflection.is(candidate, 'core.ship.Ship')) {
        const heading = candidate.get_course();
        if (!heading) continue;
        const boosting = boostActiveAt(candidate, now);
        if (
          boostActiveAt(candidate, from) !== boosting ||
          boostActiveAt(candidate, heading.time) !== boosting
        )
          continue;
        const targetStartOffset = projectileOffsetSeconds(from, heading.time, 100);
        const targetEndOffset = projectileOffsetSeconds(now, heading.time, 100);
        if (!Number.isFinite(targetStartOffset) || !Number.isFinite(targetEndOffset)) continue;
        targetStartX = heading.pos.x + heading.speed.x * targetStartOffset;
        targetStartY = heading.pos.y + heading.speed.y * targetStartOffset;
        targetEndX = heading.pos.x + heading.speed.x * targetEndOffset;
        targetEndY = heading.pos.y + heading.speed.y * targetEndOffset;
      }
      const radius = projectile.collisionRadius + candidate.collisionRadius;
      if (
        Math.max(startX, endX) + radius < Math.min(targetStartX, targetEndX) ||
        Math.min(startX, endX) - radius > Math.max(targetStartX, targetEndX) ||
        Math.max(startY, endY) + radius < Math.min(targetStartY, targetEndY) ||
        Math.min(startY, endY) - radius > Math.max(targetStartY, targetEndY)
      )
        continue;
      if (!this.isEnemy && !candidate.canBeDamage(projectile.unit, projectile)) continue;
      const fraction = torpedoImpactFraction(
        startX,
        startY,
        endX,
        endY,
        targetStartX,
        targetStartY,
        targetEndX,
        targetEndY,
        radius,
      );
      if (Number.isFinite(fraction) && fraction < bestFraction) {
        best = candidate;
        bestFraction = fraction;
        bestStartX = targetStartX;
        bestStartY = targetStartY;
        bestEndX = targetEndX;
        bestEndY = targetEndY;
      }
    }
    if (!best) return;
    const impactX = startX + (endX - startX) * bestFraction;
    const impactY = startY + (endY - startY) * bestFraction;
    if (contactObservers.size) {
      const snapshot: TorpedoContactSnapshot = {
        fromTime: from,
        toTime: now,
        fraction: bestFraction,
        impactTime: from + (now - from) * bestFraction,
        impactX,
        impactY,
        shotStartX: startX,
        shotStartY: startY,
        shotEndX: endX,
        shotEndY: endY,
        targetStartX: bestStartX,
        targetStartY: bestStartY,
        targetEndX: bestEndX,
        targetEndY: bestEndY,
        combinedRadius: projectile.collisionRadius + best.collisionRadius,
        note: 'Same-time relative sweep using short client velocity estimates; not server impact confirmation.',
      };
      for (const observer of contactObservers) {
        try {
          observer(projectile, best, snapshot);
        } catch {
          /* An optional diagnostic must not interrupt contact application. */
        }
      }
    }
    projectile.set_x(impactX);
    projectile.set_y(impactY);
    contacts.set(projectile, best);
    try {
      projectile.destroy();
    } finally {
      contacts.delete(projectile);
    }
  });
}
