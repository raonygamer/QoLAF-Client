import { read, type Raw } from '../api/Types';

/** RibbonTrail.updateHead: redraw the head without advancing tick-owned history. */
export function updateRibbonHead(trail: Raw): void {
  const head = trail.mFollowingRibbonSegmentLine?.[0];
  if (!read(trail, 'isPlaying') || !head || !trail.mNumRibbonSegments) return;
  trail.setVertexPosition(0, head.x0, head.y0);
  trail.setVertexPosition(1, head.x1, head.y1);
  trail.setVertexAlpha(0, head.alpha);
  trail.setVertexAlpha(1, head.alpha);
}

/** Projectile.positionRibbonHead uses the final displayed projectile transform. */
export function drawProjectileRibbon(projectile: Raw): void {
  const trail = projectile.ribbonTrail;
  const head = projectile.followingRibbonSegment;
  const clip = projectile._mc;
  if (!trail || !head || !clip || !read(trail, 'isPlaying') || !projectile.isVisible) return;

  const rotation = read(clip, 'rotation');
  const offset = projectile.useRibbonOffset ? -read(projectile, 'radius') : 0;
  const speed = projectile.course.speed;
  head.setTo2(
    read(clip, 'x') + Math.cos(rotation) * offset,
    read(clip, 'y') + Math.sin(rotation) * offset,
    projectile.ribbonThickness,
    Math.atan2(speed.y, speed.x) + Math.PI,
  );
  updateRibbonHead(trail);
}
