import type { API } from '../api/Types';
import { DomOverlay, Point, type DisplayObject } from '../game/Bindings';

interface WheelPopup {
  node: DisplayObject;
  height: number;
  scroll(direction: number): void;
}

/** Native wheel events must honor the Starling hit target, including covering windows. */
export function routeAutocompleteWheel(
  _api: API,
  candidates: readonly (WheelPopup | undefined)[],
  event: Pick<
    WheelEvent,
    'clientX' | 'clientY' | 'deltaY' | 'preventDefault' | 'stopImmediatePropagation'
  >,
): boolean {
  if (!event.deltaY) return false;
  const overlay = DomOverlay;
  for (const popup of candidates) {
    if (!popup) continue;
    let shown = true;
    for (let node: DisplayObject | null = popup.node; node; node = node.get_parent()) {
      if (!node.get_visible() || node.get_alpha() <= 0) {
        shown = false;
        break;
      }
    }
    if (!shown) continue;
    const stage = popup.node.get_stage();
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
    while (hit && hit !== popup.node) hit = hit.get_parent();
    if (!hit) continue;
    popup.scroll(event.deltaY);
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
  return false;
}
