import type { Raw } from '../api/Types';
import type { RadioChatBridge } from './RadioChatBridge';

/** Let the main composer work above Radio without passing its Enter/Escape to gameplay. */
export function installRadioKeyboard(
  target: Window,
  game: Raw,
  bridge: RadioChatBridge,
  activePopup: () => Raw | null | undefined,
): () => void {
  const held = new Set<string>();
  const consume = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    if (held.has(event.key)) {
      consume(event);
      return;
    }
    const popup = activePopup();
    if (!popup || !bridge.hasPopup(game)) return;
    if (event.key === 'Escape') {
      if (!bridge.ownsEscape(game, popup)) return;
      consume(event);
      held.add(event.key);
      if (!bridge.handleEscape(game, popup)) popup.dismiss();
      return;
    }
    if (!bridge.allowsChat(game) || bridge.otherInputHasFocus(game)) return;
    if (event.isComposing || event.keyCode === 229 || game.chatInput.isIMEComposing?.()) return;
    consume(event);
    held.add(event.key);
    game.chatInput.toggleChatMode();
  };
  const keyup = (event: KeyboardEvent) => {
    if (held.delete(event.key)) consume(event);
  };
  const blur = () => held.clear();
  target.addEventListener('keydown', keydown, true);
  target.addEventListener('keyup', keyup, true);
  target.addEventListener('blur', blur);
  return () => {
    held.clear();
    target.removeEventListener('keydown', keydown, true);
    target.removeEventListener('keyup', keyup, true);
    target.removeEventListener('blur', blur);
  };
}
