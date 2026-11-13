import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Login, PlayerIO, type RecoverDialog } from '../game/Bindings';

/** Restore the original recoveryInFlight guard around the native dialog callbacks. */
export function installRecoveryRequest(api: API, dialog: RecoverDialog): () => void {
  const reflection = new GameReflection(api);
  const quickConnect = PlayerIO.quickConnect;
  let pending = false;
  let disposed = false;
  const release = () => {
    pending = false;
    if (!disposed) dialog.cancelButton.set_enabled(true);
  };
  const controls = reflection.after(dialog.recoverButton, 'set_enabled', (_result, enabled) => {
    // Native code reenables Recover after failure, or after dismissing the
    // success popup. Keep Cancel locked for precisely that same interval.
    if (enabled) release();
  });
  const nativeRecover = dialog.recoverButton.callback;
  const recover = () => {
    if (!disposed && !pending) nativeRecover();
  };
  dialog.recoverButton.callback = recover;
  // Enter invokes onRecover directly and must not clear errors or resubmit while
  // the success popup/request is pending, even if focus remains in the input.
  const recoverMethod = reflection.around(dialog, 'onRecover', (next) => {
    if (!disposed && !pending) return next();
  });
  const request = reflection.around(
    quickConnect,
    'simpleRecoverPassword',
    function (next, gameId, email, success, failure) {
      if (disposed || !dialog.get_visible() || Login.currentState !== 'password_recover')
        return next(gameId, email, success, failure);
      if (pending) return;
      pending = true;
      dialog.cancelButton.set_enabled(false);
      try {
        return next(
          gameId,
          email,
          () => {
            if (!disposed) success();
          },
          (error) => {
            if (disposed) return;
            try {
              failure(error);
            } finally {
              release();
            }
          },
        );
      } catch (error) {
        release();
        dialog.recoverButton.set_enabled(true);
        throw error;
      }
    },
  );
  return () => {
    if (disposed) return;
    disposed = true;
    request();
    controls();
    recoverMethod();
    dialog.recoverButton.callback = nativeRecover;
    if (pending) {
      pending = false;
      dialog.recoverButton.set_enabled(true);
      dialog.cancelButton.set_enabled(true);
    }
  };
}
