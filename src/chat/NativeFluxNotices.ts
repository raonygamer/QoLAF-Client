import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { BuyFlux, PopupMessage, PayVault, type DisplayObject } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import type { CaptureRewardFeed } from './NativeRewardNotices';
import { PaidReceiptWatcher } from './PaidReceiptWatcher';
import { PurchaseNotice } from './PurchaseNotice';

/** Observe existing payment acknowledgments. Never initiate, finalize or retry a payment. */
export function installNativeFluxNotices(api: API, capture: CaptureRewardFeed): void {
  const reflection = new GameReflection(api);
  const buyFlux = BuyFlux.prototype;
  let active = true;
  const watchers = new Set<PaidReceiptWatcher>();
  const confirmations = new WeakMap<PopupMessage, PaidReceiptWatcher>();
  const captureAnnouncement = (screen: BuyFlux, bundle: { amount: number }) => {
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
  {
    reflection.around(buyFlux, 'onBuyPaypal', function (next, bundle, ...args) {
      const purchase = captureAnnouncement(this, bundle);
      const transport = ClientIPCService.instance;
      const login = transport?.loginId;
      // Haxe omits readHistory, but the unchanged JS SDK exposes it on raw.
      const vault = this.g.client?.payVault?.raw;
      if (!purchase || !transport || !login || typeof vault?.readHistory !== 'function')
        return next(bundle, ...args);
      const candidate: unknown = this.g.overlay;
      if (!reflection.is(candidate, 'starling.display.Sprite')) return next(bundle, ...args);
      const overlay = candidate;
      const previous = new Set<DisplayObject>();
      for (let index = 0; index < overlay.get_numChildren(); index++)
        previous.add(overlay.getChildAt(index));
      let watcher: PaidReceiptWatcher;
      watcher = new PaidReceiptWatcher(
        {
          finished: () => {
            if (watcher) watchers.delete(watcher);
          },
          current: () =>
            active && transport === ClientIPCService.instance && transport.loginId === login,
          later: (callback, ms) => {
            const timer = setTimeout(callback, ms);
            return () => clearTimeout(timer);
          },
          readHistory: (success, failure) =>
            vault.readHistory(
              0,
              30,
              (entries) => {
                // This SDK returns Date.setTime's numeric result, unlike the AS3 SDK's Date.
                if (!Array.isArray(entries)) {
                  failure();
                  return;
                }
                const normalized: Record<string, unknown>[] = [];
                const values: readonly unknown[] = entries;
                for (const entry of values) {
                  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
                  const fields: Record<string, unknown> = {};
                  for (const key of Object.keys(entry)) {
                    Object.defineProperty(fields, key, {
                      value: Reflect.get(entry, key),
                      enumerable: true,
                      writable: true,
                      configurable: true,
                    });
                  }
                  const timestamp = fields.timestamp;
                  if (typeof timestamp === 'number' && Number.isFinite(timestamp))
                    fields.timestamp = new Date(timestamp);
                  normalized.push(fields);
                }
                success(normalized);
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
        for (let index = 0; index < overlay.get_numChildren(); index++) {
          const child = overlay.getChildAt(index);
          if (!previous.has(child) && child instanceof PopupMessage) {
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
    reflection.before(PopupMessage.prototype, 'dispose', function () {
      const watcher = confirmations.get(this);
      if (!watcher) return;
      confirmations.delete(this);
      watcher.dispose();
    });
    reflection.before(PopupMessage.prototype, 'close', function () {
      const watcher = confirmations.get(this);
      if (!watcher) return;
      confirmations.delete(this);
      watcher.request();
    });
  }

  type SteamPurchase = { vault: PayVault; announce: () => void };
  let preparing: SteamPurchase | null = null;
  let orders = new WeakMap<PayVault, Map<string | number, SteamPurchase>>();
  {
    reflection.around(buyFlux, 'onBuySteam', function (next, bundle, ...args) {
      const previous = preparing;
      const purchase = captureAnnouncement(this, bundle);
      preparing = purchase ? { vault: this.g.client.payVault, announce: purchase.announce } : null;
      try {
        return next(bundle, ...args);
      } finally {
        preparing = previous;
      }
    });
    reflection.around(
      PayVault.prototype,
      'getBuyCoinsInfo',
      function (next, provider, info, success, ...args) {
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
          function (this: unknown, reply: Record<string, unknown>) {
            if (
              active &&
              reply &&
              (typeof reply.orderid === 'string' || typeof reply.orderid === 'number')
            ) {
              let pending = orders.get(purchase.vault);
              if (!pending) orders.set(purchase.vault, (pending = new Map()));
              pending.set(reply.orderid, purchase);
            }
            return success.call(this, reply);
          },
          ...args,
        );
      },
    );
    reflection.around(
      PayVault.prototype,
      'usePaymentInfo',
      function (next, provider, info, success, failure, ...args) {
        const pending = orders.get(this);
        const orderId = info.orderid;
        const purchase =
          provider === 'steam' && (typeof orderId === 'string' || typeof orderId === 'number')
            ? pending?.get(orderId)
            : null;
        if (!pending || !purchase || (typeof orderId !== 'string' && typeof orderId !== 'number'))
          return next(provider, info, success, failure, ...args);
        // One observed completion per order; the native payment owns all retries.
        pending.delete(orderId);
        return next(
          provider,
          info,
          function (this: unknown, result: unknown) {
            purchase.announce();
            return success.call(this, result);
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
