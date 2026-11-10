import type { API, Raw } from '../Api/Types';
import type { DamageObserver } from './DamageObserver';

type ContactScan = { projectile: Raw; candidate: Raw | null };

/**
 * Recover the candidate at the native collision branch without repeating its
 * geometry or scanning units again. Audited ProjectileBullet/Bouncing execute
 * methods only destroy/explode after that branch; lifetime removal happens
 * outside execute. A damage eligibility check alone is never a hit.
 */
export function installProjectileContacts(api: API, game: Raw, observer: DamageObserver): void {
  const unit = api.cls('core.unit.Unit')?.prototype;
  const projectile = api.cls('core.projectile.Projectile')?.prototype;
  if (
    typeof unit?.canBeDamage !== 'function' ||
    typeof projectile?.destroy !== 'function' ||
    typeof projectile?.explode !== 'function'
  )
    return;
  let scan: ContactScan | null = null;

  api.after(unit, 'canBeDamage', function (eligible, _attacker, projectile) {
    if (scan && scan.projectile === projectile) scan.candidate = eligible ? this : null;
  });

  const contact = (projectile: Raw) => {
    if (scan?.projectile !== projectile || !scan.candidate) return;
    const target = scan.candidate;
    scan.candidate = null;
    observer.hit(projectile.weapon, target);
  };
  // destroy() can call explode(): consume the candidate before either callback.
  for (const name of ['destroy', 'explode'])
    api.before(projectile, name, function () {
      contact(this);
    });
  const stuck = api.cls('core.states.aistates.ProjectileStuck')?.prototype;
  if (typeof stuck?.enter === 'function')
    api.before(stuck, 'enter', function () {
      contact(this.p);
    });

  for (const [name, families] of [
    ['ProjectileBullet', ['bullet', 'targetPainter']],
    ['Bouncing', ['bouncing']],
  ] as const) {
    const state = api.cls(`core.states.aistates.${name}`)?.prototype;
    if (typeof state?.execute !== 'function') continue;
    // Bomb bullets also need the native stuck transition, not a later explosion.
    if (name === 'ProjectileBullet' && typeof stuck?.enter !== 'function') continue;
    for (const family of families) observer.contactFamilies.add(family);
    api.around(state, 'execute', function (next, ...args) {
      if (this.m !== game || !observer.canEstimate(this.p?.weapon)) return next(...args);
      if (this.isEnemy) {
        // This native branch does not call canBeDamage, so candidate attribution is absent.
        observer.partial(this.p.weapon);
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
