import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ParallaxManager } from '../game/Bindings';

/** Clear only the parallax-owned display objects, including before gameReady. */
export function installParallaxCleanup(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(ParallaxManager.prototype, 'clear', function () {
    if (!this.initialized) return;
    this.nebulaContainer.removeFromParent();
    this.starBatch.removeFromParent();
    this.nebulaContainer.removeChildren(0, -1, true);
    this.starBatch.clear();
    this.nebulas.length = 0;
    this.stars.length = 0;
    this.miniStars.length = 0;
    this.miniDusts.length = 0;
    this.initialized = false;
  });
}
