import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  GameObject,
  Projectile,
  ProjectileBullet,
  Ship,
  Unit,
  type GameScene,
} from '../game/Bindings';
import type { DiagnosticProjectile } from '../game/ProjectileDiagnostics';
import { matchesDebugTorpedo } from './TorpedoDebugSnapshots';

type Bounds = {
  cosine: number;
  sine: number;
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
};
type Scan = {
  projectile: DiagnosticProjectile;
  bounds: Bounds | null;
  candidate: Unit | null;
  candidateX: number;
  finished: boolean;
};

function bounds(projectile: Projectile): Bounds | null {
  const position = projectile.course.pos;
  const previous = projectile.oldPos;
  if (position.x === previous.x && position.y === previous.y) return null;
  const angle = -Math.atan2(position.y - previous.y, position.x - previous.x);
  const cosine = Math.cos(angle);
  let sine = Math.sin(angle);
  if (Math.abs(sine) < 0.0001) sine = 0.0001;
  const fromX = previous.x * cosine - previous.y * sine;
  const fromY = previous.x * sine + previous.y * cosine;
  const toX = position.x * cosine - position.y * sine;
  const toY = position.x * sine + position.y * cosine;
  const radius = projectile.collisionRadius;
  return {
    cosine,
    sine,
    minimumX: Math.min(fromX, toX) - radius,
    maximumX: Math.max(fromX, toX) + radius,
    minimumY: Math.min(fromY, toY) - radius,
    maximumY: Math.max(fromY, toY) + radius,
  };
}

/** Current native legacy execute reads candidate x/y after eligibility, before its solver. */
export function installLegacyTorpedoContacts(
  api: API,
  active: (game: GameScene) => boolean,
  contact: (projectile: Projectile, target: Unit) => void,
  failed: (game: GameScene, error: unknown) => void,
): void {
  const reflection = new GameReflection(api);
  let scan: Scan | null = null;
  let suspended = 0;
  reflection.around(ProjectileBullet.prototype, 'execute', function (next) {
    const projectile: DiagnosticProjectile = this.p;
    if (
      !active(this.m) ||
      !matchesDebugTorpedo(projectile) ||
      projectile.get_usesServerBulletCourse?.()
    )
      return next();
    const previous = scan;
    scan = { projectile, bounds: null, candidate: null, candidateX: NaN, finished: false };
    try {
      return next();
    } finally {
      scan = previous;
    }
  });

  const observePosition = (target: GameObject, x: number, y: number): void => {
    const current = scan;
    if (!current || suspended || current.finished || !(target instanceof Unit)) return;
    if (!active(current.projectile.g)) return;
    // Native get_pos().x and get_pos().y are separate reads. Copy the exact
    // values at those reads, then report before either solver writes its impact point.
    if (current.candidate !== target) {
      current.candidate = target;
      current.candidateX = x;
      current.bounds ??= bounds(current.projectile);
      return;
    }
    current.candidate = null;
    const box = current.bounds;
    if (!box) return;
    const projectile = current.projectile;
    const dx = projectile.course.pos.x - current.candidateX;
    const dy = projectile.course.pos.y - y;
    if (dx * dx + dy * dy > 2500) return;
    const rotatedX = current.candidateX * box.cosine - y * box.sine;
    const rotatedY = current.candidateX * box.sine + y * box.cosine;
    const radius = target.collisionRadius;
    if (
      !(
        rotatedX <= box.maximumX + radius &&
        rotatedX > box.minimumX - radius &&
        rotatedY <= box.maximumY + radius &&
        rotatedY > box.minimumY - radius
      )
    )
      return;
    // Bomb/stuck and one-hit branches return immediately after this contact.
    if (projectile.isBomb || projectile.numberOfHits <= 1) current.finished = true;
    suspended++;
    try {
      contact(projectile, target);
    } finally {
      suspended--;
    }
  };
  for (const prototype of [GameObject.prototype, Ship.prototype]) {
    reflection.after(prototype, 'get_pos', function (position) {
      if (!scan || suspended) return;
      try {
        observePosition(this, position.x, position.y);
      } catch (error) {
        const current = scan;
        if (current) {
          current.finished = true;
          suspended++;
          try {
            failed(current.projectile.g, error);
          } finally {
            suspended--;
          }
        }
      }
    });
  }
  // Explosion handlers can read many units while the native scan is still on
  // the stack. Those reads are effects, not the next collision candidate.
  reflection.around(Projectile.prototype, 'explode', function (next, ...args) {
    suspended++;
    try {
      return next(...args);
    } finally {
      suspended--;
    }
  });
  reflection.around(Projectile.prototype, 'destroy', function (next, ...args) {
    suspended++;
    try {
      return next(...args);
    } finally {
      suspended--;
    }
  });
}
