import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { ClientHelpWelcomeState } from './ClientHelpWelcomeState';
import { createClientHelpWelcomePopup } from './ClientHelpWelcomePopup';

const profileState = new ClientHelpWelcomeState();

/** Defer the invitation until existing modal/reconnect screens have finished. */
export function installNativeClientWelcome(
  api: API,
  game: Raw,
  resolve: Resolve,
  openHelp: () => void,
  waitingForRelease: () => boolean = () => false,
): () => void {
  const storage = createClientWelcomeStorage(api);
  profileState.initialize(storage);
  let popup: any = null;
  let stopped = false;
  let stopPolling = () => {};
  const isCurrent = () => api.game === game && !game.isLeaving;
  const remove = () => {
    const previous = popup;
    popup = null;
    if (!previous) return;
    previous.removeEventListener('accept', accept);
    previous.removeEventListener('close', close);
    if (read(previous, 'parent') && !game.isLeaving) {
      const recovering = game.isRecoveringGameConnection;
      game.removeChildFromOverlay(previous, true);
      if (recovering) game.blockHotkeys = true;
    } else previous.dispose();
  };
  const dismiss = () => {
    profileState.dismiss(storage);
    stopPolling();
    remove();
  };
  const canDismiss = (event: Raw) =>
    isCurrent() &&
    !game.isRecoveringGameConnection &&
    popup &&
    read(event, 'currentTarget') === popup &&
    read(popup, 'parent');
  const accept = (event: Raw) => {
    if (!canDismiss(event)) return;
    dismiss();
    openHelp();
  };
  const close = (event: Raw) => {
    if (canDismiss(event)) dismiss();
  };
  if (profileState.pending) {
    const Popup = createClientHelpWelcomePopup(resolve);
    const Modal = resolve('core.hud.components.dialogs.PopupMessage');
    stopPolling = api.interval(() => {
      if (stopped || !isCurrent() || !profileState.pending || popup || waitingForRelease()) return;
      if (!read(game, 'me') || game.isRecoveringGameConnection || game.blockHotkeys) return;
      const overlay = game.overlay;
      for (let index = 0; index < read(overlay, 'numChildren', 0); index++) {
        const child = overlay.getChildAt(index);
        if (child instanceof Modal && read(child, 'visible', true)) return;
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
export function createClientWelcomeStorage(api: API): Raw {
  const key = 'client-welcome';
  let data: Raw = {};
  try {
    const saved = api.storage.get<Raw | null>(key, null);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) data = { ...saved };
  } catch {
    // Session state still works when the browser denies persistent storage.
  }
  return { data, flush: () => api.storage.set(key, data) };
}
