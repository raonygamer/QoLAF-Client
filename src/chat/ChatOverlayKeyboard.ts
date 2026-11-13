/** Route chat keys independently of gameplay states, which stop running after death. */
export function installChatOverlayKeyboard(
  target: Window,
  available: () => boolean,
  isActive: () => boolean,
  ownsInput: (element: Element | null) => boolean,
  toggle: () => void,
  close: () => void,
): () => void {
  const held = new Set<string>();
  const consume = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    if (held.has(event.key)) {
      consume(event);
      return;
    }
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || !available())
      return;
    const focused = target.document.activeElement;
    if (
      focused &&
      !ownsInput(focused) &&
      focused.matches('input,textarea,select,[contenteditable="true"]')
    )
      return;
    if (event.key === 'Escape' && !isActive()) return;
    consume(event);
    held.add(event.key);
    if (event.key === 'Enter') toggle();
    else close();
  };
  const keyUp = (event: KeyboardEvent) => {
    if (held.delete(event.key)) consume(event);
  };
  const reset = () => held.clear();
  target.addEventListener('keydown', keyDown, { capture: true });
  target.addEventListener('keyup', keyUp, { capture: true });
  target.addEventListener('blur', reset);
  return () => {
    target.removeEventListener('keydown', keyDown, { capture: true });
    target.removeEventListener('keyup', keyUp, { capture: true });
    target.removeEventListener('blur', reset);
    reset();
  };
}
