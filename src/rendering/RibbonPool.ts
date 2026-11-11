import type { API, Raw } from '../api/Types';

/** RibbonTrail.resetAllTo writes the reset geometry before the next game tick. */
export function writeRibbonSegments(trail: Raw): void {
  if (trail.mNumRibbonSegments > trail.mRibbonSegments.length) return;
  for (let index = 0; index < trail.mNumRibbonSegments; index++) {
    const segment = trail.mRibbonSegments[index];
    trail.setVertexPosition(index * 2, segment.x0, segment.y0);
    trail.setVertexPosition(index * 2 + 1, segment.x1, segment.y1);
    trail.setVertexAlpha(index * 2, segment.alpha);
    trail.setVertexAlpha(index * 2 + 1, segment.alpha);
    trail.alphaArray[index] = segment.alpha;
  }
}

/** Original per-life defaults; geometry remains owned by the native trail. */
export function resetRibbonForPool(trail: Raw): void {
  trail.mIsPlaying = false;
  trail.set_visible(false);
  trail.mFollowingRibbonSegmentLine = null;
  trail.mFollowingEnable = true;
  trail.mMovingRatio = 0.5;
  trail.mAlphaRatio = 0.95;
  trail.mRepeat = false;
  trail.set_alpha(1);
  trail.set_color(0xffffff);
  trail.resetAllTo(0, 0, 0, 0, 0);
}

export function installRibbonPool(api: API): void {
  const trail = api.cls('extensions.RibbonTrail')?.prototype;
  const pool = api.cls('core.pools.RibbonTrailPool')?.prototype;
  if (!trail || !pool) return;
  api.after(trail, 'resetAllTo', function () {
    writeRibbonSegments(this);
  });
  api.after(pool, 'getRibbonTrail', function (trail: Raw) {
    resetRibbonForPool(trail);
  });
  api.around(pool, 'removeRibbonTrail', function (next, trail: Raw) {
    const active = this.activeRibbonTrails.includes(trail);
    const result = next(trail);
    if (active) resetRibbonForPool(trail);
    return result;
  });
  if (typeof pool.reclaimOrphans === 'function') {
    api.around(pool, 'reclaimOrphans', function (next, ...args) {
      const count = this.inactiveRibbonTrails.length;
      const result = next(...args);
      for (let index = count; index < this.inactiveRibbonTrails.length; index++)
        resetRibbonForPool(this.inactiveRibbonTrails[index]);
      return result;
    });
  }
}
