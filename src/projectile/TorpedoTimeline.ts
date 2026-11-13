const roundingEpsilon = 0.000000000000003552713678800501;

/** First contact of two circles moving over the same interval; NaN means no hit. */
export function torpedoImpactFraction(
  shotStartX: number,
  shotStartY: number,
  shotEndX: number,
  shotEndY: number,
  targetStartX: number,
  targetStartY: number,
  targetEndX: number,
  targetEndY: number,
  radius: number,
): number {
  for (const coordinate of [
    shotStartX,
    shotStartY,
    shotEndX,
    shotEndY,
    targetStartX,
    targetStartY,
    targetEndX,
    targetEndY,
    radius,
  ]) {
    if (!Number.isFinite(coordinate) || Math.abs(coordinate) > 10000000) return NaN;
  }
  if (radius <= 0) return NaN;
  const x = shotStartX - targetStartX;
  const y = shotStartY - targetStartY;
  const distance = Math.hypot(x, y);
  if (distance <= radius) return 0;
  const velocityX = shotEndX - shotStartX - (targetEndX - targetStartX);
  const velocityY = shotEndY - shotStartY - (targetEndY - targetStartY);
  const speed = Math.hypot(velocityX, velocityY);
  if (!Number.isFinite(speed) || speed === 0) return NaN;
  const directionX = velocityX / speed;
  const directionY = velocityY / speed;
  const towards = -(x * directionX + y * directionY);
  if (towards <= 0) return NaN;
  let perpendicular = Math.abs(x * directionY - y * directionX);
  const tolerance =
    roundingEpsilon * (Math.abs(x * directionY) + Math.abs(y * directionX) + radius);
  if (perpendicular > radius + tolerance) return NaN;
  perpendicular = Math.min(perpendicular, radius);
  const halfChord = Math.sqrt(radius - perpendicular) * Math.sqrt(radius + perpendicular);
  const entryDistance = (distance - radius) * ((distance + radius) / (towards + halfChord));
  const fraction = entryDistance / speed;
  if (!Number.isFinite(fraction) || fraction < -roundingEpsilon || fraction > 1 + roundingEpsilon)
    return NaN;
  return Math.max(0, Math.min(1, fraction));
}
