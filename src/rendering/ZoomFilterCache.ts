import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { FragmentFilter, type GameScene } from '../game/Bindings';

type CachedFilter = Pick<FragmentFilter, 'get_isCached' | 'cache'>;

/** Cached filter rasters must be rebuilt when their world-to-screen scale changes. */
export class ZoomFilterCache {
  private readonly scales = new WeakMap<CachedFilter, number>();
  refresh(filter: CachedFilter, scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) return;
    if (!filter.get_isCached()) {
      this.scales.delete(filter);
      return;
    }
    const previous = this.scales.get(filter);
    if (previous !== undefined && Math.abs(previous - scale) <= 0.0001) return;
    this.scales.set(filter, scale);
    filter.cache();
  }
}

export function installZoomFilterCache(api: API, game: GameScene): void {
  const cache = new ZoomFilterCache();
  new GameReflection(api).before(FragmentFilter.prototype, 'render', function () {
    const target = this._target;
    if (!target || !game.canvas?.contains(target) || !game.camera) return;
    // zoomFactor is the destination. The camera eases the canvas scale toward
    // it over many frames, so caching only on destination changes can retain
    // the first low-resolution raster after the zoom has finished.
    cache.refresh(this, game.camera._stageContainer?.get_scaleX() ?? game.camera.get_zoomFactor());
  });
}
