import type { Projectile, RibbonTrail, RibbonSegment } from '../game/Bindings';

type RibbonHead = Pick<
  RibbonTrail,
  'get_isPlaying' | 'mNumRibbonSegments' | 'setVertexPosition' | 'setVertexAlpha'
> & {
  mFollowingRibbonSegmentLine: Pick<RibbonSegment, 'x0' | 'y0' | 'x1' | 'y1' | 'alpha'>[] | null;
};

/** RibbonTrail.updateHead: redraw the head without advancing tick-owned history. */
export function updateRibbonHead(trail: RibbonHead): void {
  const head = trail.mFollowingRibbonSegmentLine?.[0];
  if (!trail.get_isPlaying() || !head || !trail.mNumRibbonSegments) return;
  trail.setVertexPosition(0, head.x0, head.y0);
  trail.setVertexPosition(1, head.x1, head.y1);
  trail.setVertexAlpha(0, head.alpha);
  trail.setVertexAlpha(1, head.alpha);
}

/** Projectile.positionRibbonHead uses the final displayed projectile transform. */
export function drawProjectileRibbon(projectile: Projectile): void {
  const trail = projectile.ribbonTrail;
  const head = projectile.followingRibbonSegment;
  const clip = projectile._mc;
  if (!trail || !head || !clip || !trail.get_isPlaying() || !projectile.isVisible) return;

  const rotation = clip.get_rotation();
  const offset = projectile.useRibbonOffset ? -projectile.get_radius() : 0;
  const speed = projectile.course.speed;
  head.setTo2(
    clip.get_x() + Math.cos(rotation) * offset,
    clip.get_y() + Math.sin(rotation) * offset,
    projectile.ribbonThickness,
    Math.atan2(speed.y, speed.x) + Math.PI,
  );
  updateRibbonHead(trail);
}
