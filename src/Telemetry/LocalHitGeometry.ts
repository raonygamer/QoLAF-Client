/** Original finite segment/circle intersection; no simulation writes. */
export function segmentCircle(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  centerX: number,
  centerY: number,
  radius: number,
): number {
  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endX) ||
    !Number.isFinite(endY) ||
    !Number.isFinite(centerX) ||
    !Number.isFinite(centerY) ||
    !Number.isFinite(radius) ||
    radius < 0
  )
    return NaN;
  const offsetX = startX - centerX,
    offsetY = startY - centerY;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c <= 0) return 0;
  const dx = endX - startX,
    dy = endY - startY;
  const a = dx * dx + dy * dy;
  if (a <= 0) return NaN;
  const b = offsetX * dx + offsetY * dy;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return NaN;
  const fraction = (-b - Math.sqrt(discriminant)) / a;
  return fraction >= 0 && fraction <= 1 ? fraction : NaN;
}
