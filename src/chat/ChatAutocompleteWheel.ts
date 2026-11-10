import { read, type API, type Raw } from '../api/Types';

interface WheelPopup {
  node: Raw;
  height: number;
  scroll(direction: number): void;
}

/** Native wheel events must honor the Starling hit target, including covering windows. */
export function routeAutocompleteWheel(
  api: API,
  candidates: readonly (WheelPopup | undefined)[],
  event: Pick<
    WheelEvent,
    'clientX' | 'clientY' | 'deltaY' | 'preventDefault' | 'stopImmediatePropagation'
  >,
): boolean {
  if (!event.deltaY) return false;
  const overlay = api.cls('core.hud.components.ui.DomOverlay');
  const Point = api.cls('openfl.geom.Point') as any;
  if (!overlay || !Point) return false;
  for (const popup of candidates) {
    if (!popup) continue;
    let shown = true;
    for (let node: Raw | null = popup.node; node; node = read(node, 'parent')) {
      if (!read(node, 'visible', true) || read(node, 'alpha', 1) <= 0) {
        shown = false;
        break;
      }
    }
    if (!shown) continue;
    const stage = read(popup.node, 'stage');
    if (!stage) continue;
    const bounds = overlay.globalRect(popup.node);
    if (!bounds) continue;
    bounds.height = popup.height;
    const rect = overlay.toCss(bounds);
    if (
      !rect ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      event.clientX < rect.x ||
      event.clientX >= rect.x + rect.width ||
      event.clientY < rect.y ||
      event.clientY >= rect.y + rect.height
    )
      continue;
    const point = new Point(
      bounds.x + ((event.clientX - rect.x) * bounds.width) / rect.width,
      bounds.y + ((event.clientY - rect.y) * bounds.height) / rect.height,
    );
    let hit = stage.hitTest(point);
    while (hit && hit !== popup.node) hit = read(hit, 'parent');
    if (!hit) continue;
    popup.scroll(event.deltaY);
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
  return false;
}
