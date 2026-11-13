import type { API } from '../api/Types';
import { PopupMessage, type GameScene } from '../game/Bindings';
import type { Game } from '../game/Game';
import type {} from '../game/GameRecovery';
import type { Resolve } from '../runtime/HaxeInterop';
import { ClientHelpWelcomeState, type ClientWelcomeStorage } from './ClientHelpWelcomeState';
import { createClientHelpWelcomePopup } from './ClientHelpWelcomePopup';

const profileState = new ClientHelpWelcomeState();

/** Defer the invitation until existing modal/reconnect screens have finished. */
export function installNativeClientWelcome(
  api: API,
  game: GameScene,
  resolve: Resolve,
  openHelp: () => void,
  waitingForRelease: () => boolean = () => false,
): () => void {
  const storage = createClientWelcomeStorage(api);
  profileState.initialize(storage);
  let popup: InstanceType<ReturnType<typeof createClientHelpWelcomePopup>> | null = null;
  let stopped = false;
  let stopPolling = () => {};
  const isCurrent = () => api.game === game && !game.get_isLeaving();
  const remove = () => {
    const previous = popup;
    popup = null;
    if (!previous) return;
    previous.removeEventListener('accept', accept);
    previous.removeEventListener('close', close);
    if (previous.get_parent() && !game.get_isLeaving()) {
      const recovering = game.get_isRecoveringGameConnection?.();
      game.removeChildFromOverlay(previous, true);
      if (recovering) game.blockHotkeys = true;
    } else previous.dispose();
  };
  const dismiss = () => {
    profileState.dismiss(storage);
    stopPolling();
    remove();
  };
  const canDismiss = (event: Game.starling.events.Event) =>
    isCurrent() &&
    !game.get_isRecoveringGameConnection?.() &&
    popup &&
    event.currentTarget === popup &&
    popup.get_parent();
  const accept = (event: Game.starling.events.Event) => {
    if (!canDismiss(event)) return;
    dismiss();
    openHelp();
  };
  const close = (event: Game.starling.events.Event) => {
    if (canDismiss(event)) dismiss();
  };
  if (profileState.pending) {
    const Popup = createClientHelpWelcomePopup(resolve);
    stopPolling = api.interval(() => {
      if (stopped || !isCurrent() || !profileState.pending || popup || waitingForRelease()) return;
      if (!game.get_me() || game.get_isRecoveringGameConnection?.() || game.blockHotkeys) return;
      const overlay = game.overlay;
      for (let index = 0; index < overlay.get_numChildren(); index++) {
        const child = overlay.getChildAt(index);
        if (child instanceof PopupMessage && child.get_visible()) return;
      }
      popup = new Popup();
      popup.addEventListener('accept', accept);
      popup.addEventListener('close', close);
      game.addChildToOverlay(popup, true);
    }, 250);
  }
  api.defer(() => {
    stopped = true;
    stopPolling();
    remove(); // Teardown is not a deliberate dismissal.
  });
  return dismiss;
}

/** The browser game has no AS3 sharedObj; keep profile flags in plugin storage. */
export function createClientWelcomeStorage(api: API): ClientWelcomeStorage {
  const key = 'client-welcome';
  let data: Record<string, unknown> = {};
  try {
    const saved = api.storage.get<Record<string, unknown> | null>(key, null);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) data = { ...saved };
  } catch {
    // Session state still works when the browser denies persistent storage.
  }
  return { data, flush: () => api.storage.set(key, data) };
}
