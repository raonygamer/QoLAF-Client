export interface CollisionLine {
  x: number;
  y: number;
  toX: number;
  toY: number;
}

/** Original DeathLine.lineIntersection2: sweep the full displacement against a finite segment. */
export function crossesDeathLine(
  line: CollisionLine,
  destinationX: number,
  destinationY: number,
  startX: number,
  startY: number,
  clearance: number,
): boolean {
  const radius = Math.max(0, clearance);
  if (
    Math.max(destinationX, startX) < Math.min(line.x, line.toX) - radius ||
    Math.min(destinationX, startX) > Math.max(line.x, line.toX) + radius ||
    Math.max(destinationY, startY) < Math.min(line.y, line.toY) - radius ||
    Math.min(destinationY, startY) > Math.max(line.y, line.toY) + radius
  )
    return false;
  const moveX = destinationX - startX,
    moveY = destinationY - startY;
  const lineX = line.toX - line.x,
    lineY = line.toY - line.y;
  const determinant = moveX * lineY - moveY * lineX;
  if (determinant !== 0) {
    const offsetX = line.x - startX,
      offsetY = line.y - startY;
    const movementFraction = (offsetX * lineY - offsetY * lineX) / determinant;
    const lineFraction = (offsetX * moveY - offsetY * moveX) / determinant;
    if (movementFraction >= 0 && movementFraction <= 1 && lineFraction >= 0 && lineFraction <= 1)
      return true;
  }
  // Check crossing first: overlapping ships can escape outward, never through the center line.
  if (isEscapingCollision(line, destinationX, destinationY, startX, startY, radius)) return false;
  const radiusSquared = radius * radius;
  return (
    distanceSquaredToSegment(startX, startY, line.x, line.y, line.toX, line.toY) < radiusSquared ||
    distanceSquaredToSegment(destinationX, destinationY, line.x, line.y, line.toX, line.toY) <
      radiusSquared ||
    distanceSquaredToSegment(line.x, line.y, startX, startY, destinationX, destinationY) <
      radiusSquared ||
    distanceSquaredToSegment(line.toX, line.toY, startX, startY, destinationX, destinationY) <
      radiusSquared
  );
}

export function isEscapingCollision(
  line: CollisionLine,
  destinationX: number,
  destinationY: number,
  startX: number,
  startY: number,
  clearance: number,
): boolean {
  const radius = Math.max(0, clearance);
  if (radius === 0) return false;
  const lineX = line.toX - line.x,
    lineY = line.toY - line.y;
  const lengthSquared = lineX * lineX + lineY * lineY;
  let closestX = line.x,
    closestY = line.y;
  if (lengthSquared > 0) {
    const projection = Math.max(
      0,
      Math.min(1, ((startX - line.x) * lineX + (startY - line.y) * lineY) / lengthSquared),
    );
    closestX += lineX * projection;
    closestY += lineY * projection;
  }
  const awayX = startX - closestX,
    awayY = startY - closestY;
  const startDistance = awayX * awayX + awayY * awayY;
  if (startDistance >= radius * radius) return false;
  const moveX = destinationX - startX,
    moveY = destinationY - startY;
  if (moveX * moveX + moveY * moveY <= 0.000001) return false;
  const endDistance = distanceSquaredToSegment(
    destinationX,
    destinationY,
    line.x,
    line.y,
    line.toX,
    line.toY,
  );
  if (endDistance <= startDistance + 0.000001) return false;
  return moveX * awayX + moveY * awayY > 0.000001;
}

export function distanceSquaredToSegment(
  x: number,
  y: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const dx = endX - startX,
    dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return (x - startX) ** 2 + (y - startY) ** 2;
  const projection = Math.max(
    0,
    Math.min(1, ((x - startX) * dx + (y - startY) * dy) / lengthSquared),
  );
  return (x - (startX + projection * dx)) ** 2 + (y - (startY + projection * dy)) ** 2;
}
