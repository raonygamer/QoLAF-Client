import { withRetainedEmitterLifetime } from '../rendering/EmitterLifetime';
import type { API } from '../api/Types';
import { Beam, EmitterFactory, type Emitter } from '../game/Bindings';
import { GameReflection } from '../api/GameReflection';

/** Beam endpoints outlive particle bursts; only weapon destruction releases them. */
export function installNativeBeamResources(api: API): void {
  const reflection = new GameReflection(api);
  const beam = Beam.prototype;
  const destroyed = new WeakSet<Beam>();
  let initializingEffects = false;
  reflection.around(EmitterFactory, 'create', function (next, key, ...args) {
    if (initializingEffects && (key == null || key === '')) return [];
    return next(key, ...args);
  });
  reflection.around(beam, 'initEffects', function (next, ...args) {
    const previous = initializingEffects;
    initializingEffects = true;
    try {
      return withRetainedEmitterLifetime(() => next(...args));
    } finally {
      initializingEffects = previous;
    }
  });
  reflection.after(beam, 'initEffects', function () {
    for (const emitters of [this.startEffect, this.startEffect2, this.endEffect])
      for (const emitter of emitters ?? []) {
        const retained: Emitter & { retainUntilKilled?: boolean } = emitter;
        retained.retainUntilKilled = true;
      }
    // The first shot can initialize effects after set_fire(true) has already run.
    if (this._fire)
      for (const emitters of [this.startEffect, this.startEffect2])
        for (const emitter of emitters ?? []) emitter.play();
  });
  reflection.around(beam, 'destroy', function (next, ...args) {
    if (destroyed.has(this)) return;
    destroyed.add(this);
    // Weapon.destroy currently sets alive=false. Match the source ordering so
    // callbacks triggered during resource release already see a dead weapon.
    this.alive = false;
    for (const emitters of [this.startEffect, this.startEffect2, this.endEffect]) {
      for (const emitter of emitters ?? []) emitter.killEmitter();
      if (emitters) emitters.length = 0;
    }
    this.lineBatch?.clear();
    for (const line of this.lines ?? []) {
      line.set_visible(false);
      line.clear();
      this.g.beamLinePool.removeLine(line);
    }
    if (this.lines) this.lines.length = 0;
    this.drawBeam = this.oldDrawBeam = false;
    try {
      return next(...args);
    } finally {
      // Current Haxe destroy clears the batch but never frees its GPU buffers.
      // Keep its destruction path, then apply the source-owned final release.
      this.lineBatch?.removeFromParent();
      this.lineBatch?.dispose();
      this.lineBatch = null;
    }
  });
}
