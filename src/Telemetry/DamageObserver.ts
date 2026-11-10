import { read, type API, type Raw } from '../Api/Types';
import type { Settings } from '../Settings/Settings';
import { RollingDamageEstimate } from './RollingDamageEstimate';
import { segmentCircle } from './LocalHitGeometry';

type ProjectileState = {
  hit: boolean;
  rayChecked: boolean;
  target: Raw | null;
  lifecycle: unknown;
};

/** Local observations only. Native damage values and native simulation stay authoritative. */
export class DamageObserver {
  readonly estimate = new RollingDamageEstimate();
  private readonly unitGenerations = new WeakMap<Raw, number>();
  private readonly projectiles = new WeakMap<Raw, ProjectileState>();
  constructor(
    private readonly game: Raw,
    private readonly config: Settings,
    private readonly healType: number,
    readonly now: () => number = () => performance.now(),
  ) {}

  canEstimate(weapon: Raw): boolean {
    const ship = read(this.game, 'me')?.ship;
    if (
      !weapon ||
      !ship ||
      !weapon.unit ||
      this.game.isLeaving ||
      !this.config.show_radar_dps ||
      (weapon.unit !== ship && weapon.unit.owner !== ship) ||
      !weapon.dmg ||
      weapon.dmg.type === this.healType
    )
      return false;
    const amount = weapon.dmg.dmg();
    return Number.isFinite(amount) && amount > 0;
  }

  hit(weapon: Raw, target: Raw | null, count = 1): void {
    const ship = read(this.game, 'me')?.ship;
    if (
      !this.canEstimate(weapon) ||
      !target?.alive ||
      target.invulnerable ||
      target === weapon.unit ||
      target === ship ||
      target.owner === ship ||
      !(target.isHostile || weapon.unit.isHostile)
    )
      return;
    this.estimate.record(weapon.dmg.dmg() * count, this.now());
  }

  partial(weapon: Raw): void {
    if (this.canEstimate(weapon)) this.estimate.markPartial(this.now());
  }

  resetUnit(unit: Raw): void {
    this.unitGenerations.set(unit, (this.unitGenerations.get(unit) ?? 0) + 1);
  }

  private lifecycle(unit: Raw | null): unknown {
    return unit ? (this.unitGenerations.get(unit) ?? unit.lifecycleId ?? 0) : 0;
  }

  stuck(projectile: Raw, target: Raw): void {
    if (!this.canObserve(projectile) || this.state(projectile).hit) return;
    this.state(projectile).hit = true;
    this.hit(projectile.weapon, target);
  }

  reset(projectile: Raw): void {
    this.projectiles.delete(projectile);
  }

  private state(projectile: Raw): ProjectileState {
    let state = this.projectiles.get(projectile);
    if (!state) {
      state = {
        hit: false,
        rayChecked: false,
        target: projectile.target ?? null,
        lifecycle: this.lifecycle(projectile.target),
      };
      this.projectiles.set(projectile, state);
    }
    return state;
  }

  private canObserve(projectile: Raw): boolean {
    return projectile.g === this.game && !projectile.isHeal && this.canEstimate(projectile.weapon);
  }

  private valid(projectile: Raw, target: Raw): boolean {
    return (
      !!target?.alive && !target.invulnerable && target.canBeDamage(projectile.unit, projectile)
    );
  }

  private omissions(projectile: Raw): void {
    const state = this.state(projectile);
    if (
      (projectile.ai !== 'instant' &&
        projectile.ai !== 'homingMissile' &&
        projectile.ai !== 'mine') ||
      projectile.dmgRadius > 0 ||
      projectile.clusterNrOfSplits > 0 ||
      (projectile.ai === 'instant' && !state.rayChecked) ||
      ((projectile.ai === 'instant' || projectile.ai === 'homingMissile') &&
        projectile.numberOfHits > 1) ||
      (projectile.ai === 'homingMissile' && !projectile.target)
    )
      this.partial(projectile.weapon);
  }

  activate(projectile: Raw): void {
    const state = this.state(projectile);
    state.target = projectile.target ?? null;
    state.lifecycle = this.lifecycle(projectile.target);
    if (!this.canObserve(projectile)) return;
    if (projectile.ai !== 'instant' || state.rayChecked) {
      this.omissions(projectile);
      return;
    }
    state.rayChecked = true;
    this.omissions(projectile);
    const { pos, rotation } = projectile.course;
    if (
      !projectile.alive ||
      !Number.isFinite(projectile.range) ||
      projectile.range <= 0 ||
      !Number.isFinite(rotation)
    ) {
      this.partial(projectile.weapon);
      return;
    }
    const endX = pos.x + Math.cos(rotation) * projectile.range;
    const endY = pos.y + Math.sin(rotation) * projectile.range;
    const units = this.game.unitManager.units as Raw[];
    if (units.length > 512) this.partial(projectile.weapon);
    let closest: Raw | null = null,
      nearest = Infinity;
    for (let i = 0; i < Math.min(units.length, 512); i++) {
      const target = units[i];
      if (!this.valid(projectile, target)) continue;
      const center = read(target, 'pos');
      const fraction = segmentCircle(
        pos.x,
        pos.y,
        endX,
        endY,
        center.x,
        center.y,
        target.collisionRadius + Math.max(0, projectile.collisionRadius),
      );
      if (fraction < nearest) {
        closest = target;
        nearest = fraction;
      }
    }
    if (closest && !state.hit) {
      state.hit = true;
      this.hit(projectile.weapon, closest);
    }
  }

  step(projectile: Raw, x: number, y: number): void {
    if (!projectile.alive || !this.canObserve(projectile)) return;
    this.omissions(projectile);
    const state = this.state(projectile);
    if (projectile.ai !== 'homingMissile' || state.hit) return;
    const target = projectile.target;
    if (
      !this.valid(projectile, target) ||
      target !== state.target ||
      this.lifecycle(target) !== state.lifecycle
    ) {
      this.partial(projectile.weapon);
      return;
    }
    const center = read(target, 'pos'),
      pos = projectile.course.pos;
    if (
      !Number.isNaN(
        segmentCircle(
          x,
          y,
          pos.x,
          pos.y,
          center.x,
          center.y,
          target.collisionRadius + Math.max(0, projectile.collisionRadius),
        ),
      )
    ) {
      state.hit = true;
      this.hit(projectile.weapon, target);
    }
  }

  remove(projectile: Raw): void {
    if (!projectile.alive || !this.canObserve(projectile)) return;
    this.omissions(projectile);
    if (projectile.ai === 'homingMissile' && !this.state(projectile).hit)
      this.partial(projectile.weapon);
  }

  explode(projectile: Raw): void {
    if (!this.canObserve(projectile) || projectile.ai !== 'mine') return;
    const state = this.state(projectile);
    if (state.hit) return;
    state.hit = true;
    const pos = read(projectile, 'pos');
    let closest: Raw | null = null,
      nearest = Infinity;
    for (const target of this.game.unitManager.units) {
      if (!this.valid(projectile, target)) continue;
      const center = read(target, 'pos');
      const radius =
        Math.max(0, projectile.dmgRadius) +
        (Number.isNaN(target.collisionRadius) ? 0 : Math.max(0, target.collisionRadius));
      const distance = (center.x - pos.x) ** 2 + (center.y - pos.y) ** 2;
      if (distance <= radius * radius && distance < nearest) {
        closest = target;
        nearest = distance;
      }
    }
    if (closest) this.hit(projectile.weapon, closest);
  }
}

export function installDamageObserver(api: API, game: Raw, config: Settings): DamageObserver {
  const observer = new DamageObserver(game, config, api.cls('core.weapon.Damage')?.HEAL ?? 6);
  const unit = api.cls('core.unit.Unit')?.prototype;
  if (typeof unit?.reset === 'function')
    api.before(unit, 'reset', function () {
      observer.resetUnit(this);
    });
  const stuck = api.cls('core.states.aistates.MissileStuck')?.prototype;
  if (typeof stuck?.enter === 'function')
    api.after(stuck, 'enter', function () {
      observer.stuck(this.p, this.stuckUnit);
    });
  const projectile = api.cls('core.projectile.Projectile')?.prototype;
  const manager = api.cls('core.projectile.ProjectileManager')?.prototype;
  if (typeof manager?.activateProjectile === 'function')
    api.after(manager, 'activateProjectile', function (_result, value) {
      observer.activate(value);
    });
  if (projectile) {
    if (typeof projectile.update === 'function')
      api.around(projectile, 'update', function (next, ...args) {
        const { x, y } = this.course.pos;
        const result = next(...args);
        observer.step(this, x, y);
        return result;
      });
    for (const [name, callback] of [
      ['reset', (value: Raw) => observer.reset(value)],
      ['destroy', (value: Raw) => observer.remove(value)],
      ['explode', (value: Raw) => observer.explode(value)],
    ] as const)
      if (typeof projectile[name] === 'function')
        api.before(projectile, name, function () {
          callback(this);
        });
  }
  // Count successful native heat checks inside shoot(), including Haxe's up-to-eight catch-up ticks.
  // No extra canFire() calls: those consume heat and must remain wholly native.
  let beamContext: { heat: Raw; count: number } | null = null;
  const heat = api.cls('core.weapon.Heat')?.prototype;
  if (typeof heat?.canFire === 'function')
    api.after(heat, 'canFire', function (result) {
      if (result && beamContext?.heat === this) beamContext.count++;
    });
  const beam = api.cls('core.weapon.Beam')?.prototype;
  if (typeof beam?.shoot === 'function')
    api.around(beam, 'shoot', function (next, ...args) {
      if (this.g !== game || !observer.canEstimate(this)) return next(...args);
      const previous = beamContext;
      const context = { heat: this.unit.weaponHeat, count: 0 };
      beamContext = context;
      const fireNextTime = this.fireNextTime,
        lastFire = this.lastFire;
      try {
        const result = next(...args);
        let count = context.count;
        // Pets/turrets do not run PlayerShip heat checks. Infer only the native timer progression.
        if (
          !context.heat &&
          this.lastFire === game.time &&
          this.fireNextTime !== fireNextTime &&
          this.reloadTime > 0
        ) {
          const firstNext =
            lastFire === 0 || fireNextTime === 0
              ? game.time + this.reloadTime - 33
              : fireNextTime + this.reloadTime;
          count = Math.max(
            0,
            Math.min(8, 1 + Math.round((this.fireNextTime - firstNext) / this.reloadTime)),
          );
        }
        if (count > 0) {
          observer.hit(this, this.target, count);
          if (this.secondaryTargets?.length) observer.partial(this);
        }
        return result;
      } finally {
        beamContext = previous;
      }
    });
  return observer;
}
