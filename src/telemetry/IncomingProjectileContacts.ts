import { torpedoContact } from '../projectile/TorpedoCourses';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Ship,
  PlayerShip,
  Projectile,
  Beam,
  Damage,
  MissileStuck,
  ProjectileStuck,
  ProjectileBullet,
  Bouncing,
  type GameScene,
  type Unit,
  type Weapon,
  type Player,
} from '../game/Bindings';

type IncomingPlayer = Player & { recordIncomingWeaponHit?: (weapon: Weapon) => void };

/** Observe native collision exits without changing geometry or projectile state. */
export function installIncomingProjectileContacts(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  let scan: { projectile: Projectile; candidate: PlayerShip | null } | null = null;
  const eligibleWeapon = (weapon: Weapon | null): weapon is Weapon => {
    const source = weapon?.unit;
    return !!(
      weapon &&
      source &&
      weapon.g === game &&
      !game.get_isLeaving() &&
      !(source instanceof PlayerShip) &&
      !source.owner &&
      weapon.dmg &&
      weapon.dmg.type !== Damage.HEAL
    );
  };
  const recordHit = (weapon: Weapon | null, victim: Unit | null | undefined) => {
    if (
      !(victim instanceof PlayerShip) ||
      !victim.alive ||
      victim.invulnerable ||
      !victim.player ||
      victim.player.ship !== victim ||
      !eligibleWeapon(weapon)
    )
      return;
    const amount = weapon.dmg.dmg();
    if (!Number.isFinite(amount) || amount <= 0) return;
    const player: IncomingPlayer = victim.player;
    player.recordIncomingWeaponHit?.(weapon);
  };
  reflection.around(Beam.prototype, 'shoot', function (next, ...args) {
    if (!eligibleWeapon(this) || this.targetBody != null) return next(...args);
    const due = this.fireNextTime < game.time;
    const result = next(...args);
    // Aiming/drawing between fire ticks is not a contact. Native NPC beams
    // record lastFire only when their due iteration reaches a live target.
    if (due && this.lastFire === game.time) recordHit(this, this.target);
    return result;
  });
  const record = (projectile: Projectile, explicitTarget?: Unit | null) => {
    if (scan?.projectile !== projectile) return;
    const victim = explicitTarget ?? scan.candidate;
    scan.candidate = null;
    recordHit(projectile.weapon, victim);
  };
  reflection.after(MissileStuck.prototype, 'enter', function () {
    if (this.m === game) recordHit(this.p.weapon, this.stuckUnit);
  });
  reflection.after(Ship.prototype, 'get_pos', function () {
    if (scan && this instanceof PlayerShip) scan.candidate = this;
  });
  // Position reads only identify candidates; only successful collision branches
  // destroy/explode here. Consume before destroy can invoke explode a second time.
  for (const method of ['destroy', 'explode'] as const)
    reflection.before(Projectile.prototype, method, function () {
      const target = torpedoContact(this);
      if (target) {
        if (method === 'destroy' && this.g === game) recordHit(this.weapon, target);
        return;
      }
      record(this);
    });
  reflection.before(ProjectileStuck.prototype, 'enter', function () {
    record(this.p, this.stuckUnit);
  });
  for (const State of [ProjectileBullet, Bouncing]) {
    reflection.around(State.prototype, 'execute', function (next, ...args) {
      if (this.m !== game || !this.isEnemy || !eligibleWeapon(this.p.weapon)) return next(...args);
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
