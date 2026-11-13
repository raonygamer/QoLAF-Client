import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { RibbonTrail, RibbonTrailPool } from '../game/Bindings';

/** RibbonTrail.resetAllTo writes the reset geometry before the next game tick. */
export function writeRibbonSegments(trail: RibbonTrail): void {
  const segments = trail.mRibbonSegments;
  if (!segments || trail.mNumRibbonSegments > segments.length) return;
  for (let index = 0; index < trail.mNumRibbonSegments; index++) {
    const segment = segments[index];
    trail.setVertexPosition(index * 2, segment.x0, segment.y0);
    trail.setVertexPosition(index * 2 + 1, segment.x1, segment.y1);
    trail.setVertexAlpha(index * 2, segment.alpha);
    trail.setVertexAlpha(index * 2 + 1, segment.alpha);
    trail.alphaArray[index] = segment.alpha;
  }
}

/** Original per-life defaults; geometry remains owned by the native trail. */
export function resetRibbonForPool(trail: RibbonTrail): void {
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
  const trail = RibbonTrail.prototype;
  const pool = RibbonTrailPool.prototype;
  const reflection = new GameReflection(api);
  reflection.after(trail, 'resetAllTo', function () {
    writeRibbonSegments(this);
  });
  reflection.after(pool, 'getRibbonTrail', function (trail) {
    resetRibbonForPool(trail);
  });
  reflection.around(pool, 'removeRibbonTrail', function (next, trail) {
    const inactiveCount = this.inactiveRibbonTrails?.length ?? 0;
    next(trail);
    const inactive = this.inactiveRibbonTrails;
    // Native removal validates poolIndex and swaps in O(1). Reset only a trail
    // it actually returned, without scanning or changing that newer pool logic.
    if (inactive && inactive.length > inactiveCount && inactive.at(-1) === trail)
      resetRibbonForPool(trail);
  });
  reflection.around(pool, 'reclaimOrphans', function (next) {
    const count = this.inactiveRibbonTrails?.length ?? 0;
    const result = next();
    const inactive = this.inactiveRibbonTrails;
    if (inactive) {
      for (let index = count; index < inactive.length; index++) resetRibbonForPool(inactive[index]);
    }
    return result;
  });
}
