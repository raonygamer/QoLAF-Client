import { read, type API, type Raw } from '../api/Types';
import { ClientIpcService } from '../ipc/ClientIpcService';
import type { CaptureRewardFeed } from './NativeRewardNotices';
import { PaidReceiptWatcher } from './PaidReceiptWatcher';
import { PurchaseNotice } from './PurchaseNotice';

/** Observe existing payment acknowledgments. Never initiate, finalize or retry a payment. */
export function installNativeFluxNotices(api: API, capture: CaptureRewardFeed): void {
  const BuyFlux = api.cls('core.hud.components.credits.BuyFlux')?.prototype;
  if (!BuyFlux) return;
  let active = true;
  const watchers = new Set<PaidReceiptWatcher>();
  const confirmations = new WeakMap<Raw, PaidReceiptWatcher>();
  const captureAnnouncement = (screen: Raw, bundle: Raw) => {
    const feed = capture(screen.g);
    const base = bundle?.amount;
    const total = Math.round(base * (screen.sale ? screen.saleMultiplier : 1));
    const label = PurchaseNotice.fluxLabel(total);
    if (!feed || typeof base !== 'number' || !PurchaseNotice.fluxLabel(base) || !label) return null;
    const operation = {};
    return {
      base,
      total,
      announce: () => {
        if (!active) return;
        try {
          feed.announcePurchase(label, operation);
        } catch {
          /* Native purchase completion still runs. */
        }
      },
    };
  };
  const Popup = api.cls('core.hud.components.dialogs.PopupMessage') as any;
  if (BuyFlux.onBuyPaypal && Popup?.prototype.close) {
    api.around(BuyFlux, 'onBuyPaypal', function (next, bundle, ...args) {
      const purchase = captureAnnouncement(this, bundle);
      const transport = ClientIpcService.instance;
      const login = transport?.loginId;
      // Haxe omits readHistory, but the unchanged JS SDK exposes it on raw.
      const vault = this.g.client?.payVault?.raw;
      if (!purchase || !transport || !login || typeof vault?.readHistory !== 'function')
        return next(bundle, ...args);
      const overlay = this.g.overlay;
      const previous = new Set<Raw>();
      for (let index = 0; index < read(overlay, 'numChildren', 0); index++)
        previous.add(overlay.getChildAt(index));
      let watcher: PaidReceiptWatcher;
      watcher = new PaidReceiptWatcher(
        {
          finished: () => {
            if (watcher) watchers.delete(watcher);
          },
          current: () =>
            active && transport === ClientIpcService.instance && transport.loginId === login,
          later: (callback, ms) => {
            const timer = setTimeout(callback, ms);
            return () => clearTimeout(timer);
          },
          readHistory: (success, failure) =>
            vault.readHistory(
              0,
              30,
              (entries: Raw[]) => {
                // This SDK returns Date.setTime's numeric result, unlike the AS3 SDK's Date.
                if (!Array.isArray(entries)) {
                  failure();
                  return;
                }
                success(
                  entries
                    .filter((entry) => entry && typeof entry === 'object')
                    .map((entry) => ({
                      ...entry,
                      timestamp:
                        typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)
                          ? new Date(entry.timestamp)
                          : entry.timestamp,
                    })),
                );
              },
              failure,
            ),
        },
        purchase.base,
        purchase.total,
        purchase.announce,
      );
      if (!watcher.finished) watchers.add(watcher);
      try {
        const result = next(bundle, ...args);
        let attached = false;
        for (let index = 0; index < read(overlay, 'numChildren', 0); index++) {
          const child = overlay.getChildAt(index);
          if (!previous.has(child) && child instanceof Popup) {
            confirmations.set(child, watcher);
            attached = true;
            break;
          }
        }
        if (!attached) {
          watcher.dispose();
          watchers.delete(watcher);
        }
        return result;
      } catch (error) {
        watcher.dispose();
        watchers.delete(watcher);
        throw error;
      }
    });
    api.before(Popup.prototype, 'dispose', function () {
      const watcher = confirmations.get(this);
      if (!watcher) return;
      confirmations.delete(this);
      watcher.dispose();
    });
    api.before(Popup.prototype, 'close', function () {
      const watcher = confirmations.get(this);
      if (!watcher) return;
      confirmations.delete(this);
      watcher.request();
    });
  }

  type SteamPurchase = { vault: Raw; announce: () => void };
  let preparing: SteamPurchase | null = null;
  let orders = new WeakMap<Raw, Map<unknown, SteamPurchase>>();
  const PayVault = api.cls('playerio.PayVault')?.prototype;
  if (BuyFlux.onBuySteam && PayVault?.getBuyCoinsInfo && PayVault?.usePaymentInfo) {
    api.around(BuyFlux, 'onBuySteam', function (next, bundle, ...args) {
      const previous = preparing;
      const purchase = captureAnnouncement(this, bundle);
      preparing = purchase ? { vault: this.g.client.payVault, announce: purchase.announce } : null;
      try {
        return next(bundle, ...args);
      } finally {
        preparing = previous;
      }
    });
    api.around(PayVault, 'getBuyCoinsInfo', function (next, provider, info, success, ...args) {
      const purchase = preparing;
      if (
        !purchase ||
        purchase.vault !== this ||
        provider !== 'steam' ||
        typeof success !== 'function'
      )
        return next(provider, info, success, ...args);
      return next(
        provider,
        info,
        function (this: unknown, reply: Raw, ...values: unknown[]) {
          if (
            active &&
            reply &&
            (typeof reply.orderid === 'string' || typeof reply.orderid === 'number')
          ) {
            let pending = orders.get(purchase.vault);
            if (!pending) orders.set(purchase.vault, (pending = new Map()));
            pending.set(reply.orderid, purchase);
          }
          return success.call(this, reply, ...values);
        },
        ...args,
      );
    });
    api.around(
      PayVault,
      'usePaymentInfo',
      function (next, provider, info, success, failure, ...args) {
        const pending = orders.get(this);
        const purchase = provider === 'steam' ? pending?.get(info?.orderid) : null;
        if (!purchase || typeof success !== 'function')
          return next(provider, info, success, failure, ...args);
        // One observed completion per order; the native payment owns all retries.
        pending!.delete(info.orderid);
        return next(
          provider,
          info,
          function (this: unknown, ...values: unknown[]) {
            purchase.announce();
            return success.apply(this, values);
          },
          failure,
          ...args,
        );
      },
    );
  }
  api.defer(() => {
    active = false;
    preparing = null;
    orders = new WeakMap();
    for (const watcher of watchers) watcher.dispose();
    watchers.clear();
  });
}
