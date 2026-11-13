import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Drop } from '../game/Bindings';

/** Original Drop.addToCanvasForReal makes unique-artifact loot easier to spot. */
export function installUniqueDropEffects(api: API): void {
  new GameReflection(api).around(Drop.prototype, 'addToCanvasForReal', function (next) {
    const previous = this.effect;
    const result = next();
    // Apply once per newly created effect group, including re-entry after culling.
    // Emitter identities can be reused by the native pool, so identity alone
    // must not suppress a later group's scaling.
    if (this.containsUniqueArtifact && this.effect && this.effect !== previous) {
      for (const emitter of this.effect) {
        emitter.set_startSize(emitter.get_startSize() * 1.5);
        emitter.set_finishSize(emitter.get_finishSize() * 1.5);
        emitter.set_maxParticles(Math.trunc(emitter.get_maxParticles() * 1.5));
      }
    }
    return result;
  });
}
