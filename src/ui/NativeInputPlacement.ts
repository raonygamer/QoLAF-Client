import { read, type Raw } from '../api/Types';

/** TextEntry's upstream placement drops ancestor scale from its width/height.
 * Use the same stage-space bounds as the rendered control, then let DomOverlay
 * apply viewport, browser zoom and canvas CSS scale exactly once. */
export function placeNativeInput(input: Raw, overlay: Raw | undefined): void {
  if (!input.element || !overlay?.globalRect || !overlay.place || !overlay.toCss) return;
  const bounds = overlay.globalRect(input);
  const css = overlay.toCss(bounds);
  const width = read(input, 'width', 0);
  const height = read(input, 'height', 0);
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
