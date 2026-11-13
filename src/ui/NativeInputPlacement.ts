import type { TextEntry } from '../game/Bindings';

interface InputBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Native DomOverlay operations used by input placement. */
export interface InputOverlay {
  globalRect(input: TextEntry): InputBounds;
  toCss(bounds: InputBounds): InputBounds;
  place(element: HTMLInputElement, bounds: InputBounds, visible: boolean): void;
}

/** TextEntry's upstream placement drops ancestor scale from its width/height.
 * Transform the input rectangle into stage space, then let DomOverlay
 * apply viewport, browser zoom and canvas CSS scale exactly once. */
export function placeNativeInput(input: TextEntry, overlay: InputOverlay | undefined): void {
  if (!input.element || !overlay?.globalRect || !overlay.place || !overlay.toCss) return;
  const width = input.get_width();
  const height = input.get_height();
  // Container.getBounds includes masked and horizontally scrolled glyphs.
  // Transform the declared input rectangle, never its descendants' bounds.
  const matrix = input.getTransformationMatrix?.(input.get_stage());
  let bounds: InputBounds;
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
  const size = input.textFormat?.size;
  if (typeof size === 'number' && Number.isFinite(size) && size > 0)
    style.fontSize = `${size * scaleY}px`;
  for (const key of ['paddingLeft', 'paddingRight'] as const) {
    style[key] = `${(input[key] ?? 0) * scaleX}px`;
  }
  for (const key of ['paddingTop', 'paddingBottom'] as const) {
    style[key] = `${(input[key] ?? 0) * scaleY}px`;
  }
}
