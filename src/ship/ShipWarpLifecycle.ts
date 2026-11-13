import type { API } from '../api/Types';
import { ShipWarpJump } from '../game/Bindings';
import type { Game } from '../game/Game';
import { withRetainedEmitterLifetime } from '../rendering/EmitterLifetime';

/** Preserve source warp acceleration and ownership of finite pooled effects. */
export function installShipWarpLifecycle(api: API): void {
  interface Ownership {
    engine: Game.core.engine.Engine;
    acceleration: number;
  }
  const ownership = new WeakMap<ShipWarpJump, Ownership>();
  const active = new Set<WeakRef<ShipWarpJump>>();
  const restoreAcceleration = (state: ShipWarpJump) => {
    const owned = ownership.get(state);
    if (!owned) return;
    owned.engine.acceleration = owned.acceleration;
    ownership.delete(state);
  };
  const releaseEffects = (state: ShipWarpJump) => {
    const effects = state.warpJumpEffect;
    if (!effects) return;
    for (const emitter of effects) emitter.killEmitter();
    effects.length = 0;
  };
  api.around(ShipWarpJump.prototype, 'enter', function (next) {
    const engine = this.ship.engine;
    if (engine && !ownership.has(this)) {
      ownership.set(this, { engine, acceleration: engine.acceleration });
      engine.acceleration *= 10;
      for (const reference of active) if (!reference.deref()) active.delete(reference);
      active.add(new WeakRef(this));
    }
    try {
      return withRetainedEmitterLifetime(() => next());
    } catch (error) {
      restoreAcceleration(this);
      releaseEffects(this);
      throw error;
    }
  });
  api.around(ShipWarpJump.prototype, 'exit', function (next) {
    restoreAcceleration(this);
    try {
      return next();
    } finally {
      if (this.warpJumpEffect) this.warpJumpEffect.length = 0;
    }
  });
  api.defer(() => {
    for (const reference of active) {
      const state = reference.deref();
      if (!state || !ownership.has(state)) continue;
      restoreAcceleration(state);
      releaseEffects(state);
    }
    active.clear();
  });
}
