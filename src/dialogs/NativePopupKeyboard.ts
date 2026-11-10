/** Consume modal Escape before Lime dispatches it to the game's older listeners. */
export function installPopupKeyboard(
  target: Window,
  isOpen: () => boolean,
  close: () => void,
): () => void {
  let releasingEscape = false;
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || (!isOpen() && !releasingEscape)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (releasingEscape) return;
    releasingEscape = true;
    close();
  };
  const keyup = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !releasingEscape) return;
    releasingEscape = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const blur = () => {
    releasingEscape = false;
  };
  target.addEventListener('keydown', keydown, { capture: true });
  target.addEventListener('keyup', keyup, { capture: true });
  target.addEventListener('blur', blur);
  return () => {
    target.removeEventListener('keydown', keydown, { capture: true });
    target.removeEventListener('keyup', keyup, { capture: true });
    target.removeEventListener('blur', blur);
  };
}
