import { torpedoContact } from '../projectile/TorpedoCourses';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Unit,
  Projectile,
  ProjectileStuck,
  ProjectileBullet,
  Bouncing,
  type GameScene,
} from '../game/Bindings';
import type { DamageObserver } from './DamageObserver';

type ContactScan = { projectile: Projectile; candidate: Unit | null };

/**
 * Recover the candidate at the native collision branch without repeating its
 * geometry or scanning units again. Audited ProjectileBullet/Bouncing execute
 * methods only destroy/explode after that branch; lifetime removal happens
 * outside execute. A damage eligibility check alone is never a hit.
 */
export function installProjectileContacts(
  api: API,
  game: GameScene,
  observer: DamageObserver,
): void {
  const reflection = new GameReflection(api);
  const unit = Unit.prototype;
  const projectile = Projectile.prototype;
  let scan: ContactScan | null = null;

  reflection.after(unit, 'canBeDamage', function (eligible, _attacker, projectile) {
    if (scan && scan.projectile === projectile) scan.candidate = eligible ? this : null;
  });

  const contact = (projectile: Projectile) => {
    if (scan?.projectile !== projectile || !scan.candidate) return;
    const target = scan.candidate;
    scan.candidate = null;
    if (projectile.weapon) observer.contact(projectile.weapon, target);
  };
  // destroy() can call explode(): consume the candidate before either callback.
  for (const name of ['destroy', 'explode'] as const)
    reflection.before(projectile, name, function () {
      const target = torpedoContact(this);
      if (target) {
        if (name === 'destroy' && this.g === game && this.weapon)
          observer.contact(this.weapon, target);
        return;
      }
      contact(this);
    });
  reflection.before(ProjectileStuck.prototype, 'enter', function () {
    contact(this.p);
  });

  for (const [State, families] of [
    [ProjectileBullet, ['bullet', 'targetPainter']],
    [Bouncing, ['bouncing']],
  ] as const) {
    const state = State.prototype;
    for (const family of families) observer.contactFamilies.add(family);
    reflection.around(state, 'execute', function (next, ...args) {
      const weapon = this.p.weapon;
      if (this.m !== game || !weapon || !observer.isPersonalWeapon(weapon)) return next(...args);
      if (this.isEnemy) {
        // This native branch does not call canBeDamage, so candidate attribution is absent.
        observer.partial(weapon);
        return next(...args);
      }
      const previous = scan;
      scan = { projectile: this.p, candidate: null };
      try {
        return next(...args);
      } finally {
        scan = previous;
      }
    });
  }
}
