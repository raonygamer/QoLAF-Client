import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { EnemyShip } from '../game/Bindings';

/** Original reveal presentation retains other fades underneath the cloak factor. */
export class EnemyCloakPresentation {
  private cloaked = false;
  private normalAlpha = 1;
  start(currentAlpha: number): void {
    if (this.cloaked) return;
    this.setBaseAlpha(currentAlpha);
    this.cloaked = true;
  }
  end(): void {
    this.cloaked = false;
  }
  setBaseAlpha(value: number): void {
    this.normalAlpha = Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
  }
  get alpha(): number {
    return this.normalAlpha * (this.cloaked ? 0.5 : 1);
  }
}

export function installEnemyCloakPresentation(api: API): void {
  const enemy = EnemyShip.prototype;
  const reflection = new GameReflection(api);
  const states = new WeakMap<EnemyShip, EnemyCloakPresentation>();
  const stateFor = (ship: EnemyShip) => {
    let state = states.get(ship);
    if (!state) {
      state = new EnemyCloakPresentation();
      states.set(ship, state);
    }
    return state;
  };
  const apply = (ship: EnemyShip) => ship._mc?.set_alpha(stateFor(ship).alpha);
  // The original client deliberately keeps the course and aiCloak unchanged.
  // Cloaking changes opacity rather than moving the displayed enemy off-map.
  reflection.around(enemy, 'cloakStart', function () {
    stateFor(this).start(this._mc?.get_alpha() ?? 1);
    apply(this);
  });
  reflection.around(enemy, 'cloakEnd', function () {
    stateFor(this).end();
    apply(this);
  });
  reflection.around(enemy, 'set_alpha', function (_next, value: number) {
    stateFor(this).setBaseAlpha(value);
    apply(this);
    return value;
  });
  reflection.around(enemy, 'get_alpha', function () {
    return this._mc?.get_alpha() ?? stateFor(this).alpha;
  });
  reflection.after(enemy, 'reset', function () {
    states.delete(this);
  });
  reflection.before(enemy, 'draw', function () {
    // The source applies the base fade and cloak factor before drawing the
    // hull, so a replaced/reused clip and damage overlays share its opacity.
    apply(this);
  });
  reflection.after(enemy, 'draw', function () {
    const opacity =
      this.alive && this.isAddedToCanvas && this._mc?.get_visible() ? this._mc.get_alpha() : 0;
    for (const element of [this.AFName, this.hpBar, this.shieldBar]) element?.set_alpha(opacity);
  });
}
