import type { API } from '../api/Types';
import { CreditManager } from '../game/Bindings';

/** Share one balance request and detach its callbacks before notifying listeners. */
export function installCreditRefresh(api: API): void {
  const pending = new WeakMap<CreditManager, Array<() => void>>();
  api.around(CreditManager.prototype, 'refresh', function (_next, callback) {
    const current = pending.get(this);
    if (current) {
      if (callback) current.push(callback);
      return;
    }
    const callbacks = callback ? [callback] : [];
    pending.set(this, callbacks);
    try {
      this.g.rpc('getFluxAmount', (message) => {
        // A refresh listener may synchronously request another balance update.
        pending.delete(this);
        CreditManager.FLUX = message.getInt(0);
        this.g.hud?.updateCredits();
        this.dispatchEventWith('refresh');
        for (const complete of callbacks) complete();
      });
    } catch (error) {
      if (pending.get(this) === callbacks) pending.delete(this);
      throw error;
    }
  });
}
