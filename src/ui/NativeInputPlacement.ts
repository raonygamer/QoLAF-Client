import { read, type Raw } from '../api/Types';

/** TextEntry's upstream placement drops ancestor scale from its width/height.
 * Transform the input rectangle into stage space, then let DomOverlay
 * apply viewport, browser zoom and canvas CSS scale exactly once. */
export function placeNativeInput(input: Raw, overlay: Raw | undefined): void {
  if (!input.element || !overlay?.globalRect || !overlay.place || !overlay.toCss) return;
  const width = read(input, 'width', 0);
  const height = read(input, 'height', 0);
  // Container.getBounds includes masked and horizontally scrolled glyphs.
  // Transform the declared input rectangle, never its descendants' bounds.
  const matrix = input.getTransformationMatrix?.(read(input, 'stage'));
  let bounds;
  if (matrix) {
    const x1 = matrix.a * width;
    const x2 = matrix.c * height;
    const y1 = matrix.b * width;
    const y2 = matrix.d * height;
    const left = Math.min(0, x1, x2, x1 + x2);
    const top = Math.min(0, y1, y2, y1 + y2);
    bounds = {
      x: matrix.tx + left,
      y: matrix.ty + top,
      width: Math.max(0, x1, x2, x1 + x2) - left,
      height: Math.max(0, y1, y2, y1 + y2) - top,
    };
  } else bounds = overlay.globalRect(input);
  const css = overlay.toCss(bounds);
  if (!(width > 0 && height > 0 && css.width > 0 && css.height > 0)) return;
  const scaleX = css.width / width;
  const scaleY = css.height / height;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return;
  overlay.place(input.element, bounds, true);
  const style = input.element.style;
  const size = read(read(input, 'textFormat'), 'size');
  if (Number.isFinite(size) && size > 0) style.fontSize = `${size * scaleY}px`;
  for (const key of ['paddingLeft', 'paddingRight']) {
    style[key] = `${(input[key] ?? 0) * scaleX}px`;
  }
  for (const key of ['paddingTop', 'paddingBottom']) {
    style[key] = `${(input[key] ?? 0) * scaleY}px`;
  }
}
