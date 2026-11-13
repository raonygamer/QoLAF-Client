/** Accept focus on the containing game page, but never another tab/window or an editable overlay. */
export function hasControllerFocus(): boolean {
  if (document.hidden) return false;
  if (document.hasFocus()) return true;
  try {
    if (window.parent === window || !window.parent.document.hasFocus()) return false;
    const parent = window.parent.document;
    return parent.activeElement === window.frameElement || parent.activeElement === parent.body;
  } catch {
    return false;
  }
}
