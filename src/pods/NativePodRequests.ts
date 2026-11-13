import { ClientErrorDiagnostics } from '../diagnostics/ClientErrorDiagnostics';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  CreditBuyBox,
  CreditManager,
  StarlingButton,
  Localize,
  GameScene,
  PodState,
  TweenMax,
  type Message,
  type StarlingTextField,
} from '../game/Bindings';
import { NativeUI } from '../ui/NativeUI';
import { PodMutation } from './PodMutation';
import { PodCount } from './PodCount';

// Keep unresolved operations across views and hot-disable/enable in this module.
const mutations = new WeakMap<GameScene, PodMutation>();
const mutation = (game: GameScene) => {
  let ledger = mutations.get(game);
  if (!ledger) {
    ledger = new PodMutation();
    mutations.set(game, ledger);
  }
  return ledger;
};

/** First part of the source pod recovery flow: never resend an uncertain mutation. */
export function installNativePodRequests(api: API): void {
  const reflection = new GameReflection(api);
  const ui = new NativeUI(api);
  const views = new Map<
    PodState,
    {
      active: boolean;
      confirmation: CreditBuyBox | null;
      status: StarlingTextField | null;
      uncertain: boolean;
      epoch: number;
      deadline: number;
      recoveries: number;
      tweens: Set<TweenMax>;
      count: PodCount<Message>;
    }
  >();
  let scope: PodState | null = null;
  const current = (view: PodState) => views.get(view)?.active === true && !view.g.get_isLeaving();
  const scoped = <T>(view: PodState | null, action: () => T): T => {
    const previous = scope;
    scope = view;
    try {
      return action();
    } finally {
      scope = previous;
    }
  };
  const status = (view: PodState, text: string) => {
    const state = views.get(view);
    if (!state?.active) return;
    if (!state.status) {
      state.status = ui.text(600, 64, '', 13, 0xffcc66);
      state.status.set_wordWrap(true);
      state.status.set_x(20);
      state.status.set_y(360);
      view.addChild(state.status);
    }
    state.status.set_text(text);
  };
  const refresh = (view: PodState) => {
    if (!current(view)) return;
    const ledger = mutation(view.g);
    if (!ledger.current) {
      const state = views.get(view)!;
      const enabled =
        view.g.get_connected() &&
        state.count.known &&
        !state.count.pending &&
        !state.confirmation &&
        !state.uncertain &&
        !view.openPodPending &&
        view.boughtPods === 0;
      view.buy1Button.set_enabled(enabled);
      view.buy10Button.set_enabled(enabled);
      return;
    }
    view.buy1Button.set_enabled(false);
    view.buy10Button.set_enabled(false);
    if (ledger.expired) {
      const state = views.get(view)!;
      if (!state.uncertain) {
        state.uncertain = true;
        requestCount(view);
      }
      view.closeButton.set_enabled(true);
      view.g.blockHotkeys = false;
      status(
        view,
        'No pod reply yet; the server may have processed it. You can close this screen. Wait for the reply or reconnect before buying or opening another pod.',
      );
    } else status(view, 'Waiting for the previous pod request. You can close this screen.');
  };
  const resetPresentation = (view: PodState) => {
    const state = views.get(view)!;
    state.epoch++;
    state.deadline = 0;
    for (const tween of state.tweens) tween.kill();
    state.tweens.clear();
    for (const pod of view.pods) pod.removeFromParent(true);
    view.pods.length = 0;
    view.currentPod = null;
    view.lootContainer.removeChildren(0, -1, true);
    view.tracks1.set_y(view.TRACK1_Y);
    view.tracks2.set_y(view.TRACK2_Y);
    view.openPodPending = false;
  };
  const requestCount = (view: PodState, afterMutation = false) => {
    if (!current(view)) return;
    views.get(view)!.count.request(afterMutation);
  };
  reflection.before(PodState.prototype, 'enter', function () {
    const view = this;
    const count = new PodCount<Message>({
      send: (reply) =>
        scoped(null, () => view.g.rpcMessage(view.g.createMessage('getPodCount'), reply)),
      apply: (reply) => {
        if (reply.length < 1 || reply.getInt(0) < 0) throw new Error('Invalid pod count');
        if (reply.getInt(0) > 0) views.get(view)!.deadline = performance.now() + 8000;
        scoped(view, () => view.initPodCount(reply));
        if (!mutation(view.g).current) status(view, '');
      },
      waiting: () => {
        resetPresentation(view);
        view.closeButton.set_enabled(true);
        view.g.blockHotkeys = false;
        view.buy1Button.set_enabled(false);
        view.buy10Button.set_enabled(false);
        view.nrOfPodsText.set_text('---');
      },
      timeout: () =>
        status(view, 'The pod count has not arrived. You can close this screen and try again.'),
      failed: () =>
        status(
          view,
          'Could not load the pod count. Close this screen and try again after reconnecting.',
        ),
    });
    views.set(view, {
      active: true,
      confirmation: null,
      status: null,
      uncertain: false,
      count,
      epoch: 0,
      deadline: 0,
      recoveries: 0,
      tweens: new Set(),
    });
  });
  reflection.around(PodState.prototype, 'enter', function (next) {
    return scoped(this, next);
  });
  reflection.after(PodState.prototype, 'enter', function () {
    refresh(this);
  });
  reflection.after(PodState.prototype, 'execute', function () {
    refresh(this);
    const state = views.get(this);
    if (state?.deadline && performance.now() >= state.deadline) recover(this);
  });
  const confirm = (view: PodState, count: number) => {
    const state = views.get(view);
    if (
      !state ||
      !current(view) ||
      state.confirmation ||
      !state.count.known ||
      state.count.pending ||
      state.uncertain ||
      mutation(view.g).current ||
      !view.g.get_connected() ||
      view.boughtPods > 0
    )
      return;
    const popup = new CreditBuyBox(
      view.g,
      CreditManager.getCostPods() * count,
      Localize.t(count === 1 ? 'You will recieve 1 pod.' : 'You will recieve 10 pods.'),
    );
    state.confirmation = popup;
    refresh(view);
    const release = () => {
      if (state.confirmation !== popup) return false;
      state.confirmation = null;
      popup.removeEventListeners('accept');
      popup.removeEventListeners('close');
      return true;
    };
    popup.addEventListener('accept', () => {
      if (release() && current(view)) view.buyPods(count);
    });
    popup.addEventListener('close', () => {
      if (release()) refresh(view);
    });
    view.g.addChildToOverlay(popup);
  };
  reflection.around(StarlingButton.prototype, 'dispatchEvent', function (next, event) {
    if (event.type === 'triggered') {
      for (const [view] of views) {
        if (this === view.buy1Button) {
          confirm(view, 1);
          return;
        }
        if (this === view.buy10Button) {
          confirm(view, 10);
          return;
        }
      }
    }
    return next(event);
  });
  reflection.around(PodState.prototype, 'buyPods', function (next, count) {
    if (
      !current(this) ||
      !this.g.get_connected() ||
      mutation(this.g).current ||
      views.get(this)?.uncertain ||
      !views.get(this)?.count.known ||
      views.get(this)?.count.pending
    ) {
      refresh(this);
      return;
    }
    if (this.boughtPods > 0) return;
    return scoped(this, () => {
      const message = this.g.createMessage('buyPod');
      message.add(count);
      this.g.rpcMessage(message, () => requestCount(this, true));
    });
  });
  reflection.around(PodState.prototype, 'createClickOpenPod', function (next, pod) {
    const click = next(pod);
    const view = this;
    return () => {
      if (
        !current(view) ||
        pod !== view.currentPod ||
        !view.g.get_connected() ||
        mutation(view.g).current ||
        views.get(view)?.uncertain ||
        !views.get(view)?.count.known ||
        views.get(view)?.count.pending
      ) {
        refresh(view);
        return;
      }
      return scoped(view, click);
    };
  });
  // Installed before reward-notice interception: its confirmed-reward reporting
  // still runs even when this guard drops a stale view's presentation callback.
  reflection.around(GameScene.prototype, 'rpcMessage', function (next, message, callback) {
    const view = scope;
    if (view && view.g === this && message.type === 'getPodCount') {
      requestCount(view);
      return;
    }
    if (!view || view.g !== this || (message.type !== 'buyPod' && message.type !== 'openPod'))
      return next(message, callback);
    const ledger = mutation(this);
    const operation = ledger.begin(message.type);
    if (!operation) return;
    view.buy1Button.set_enabled(false);
    view.buy10Button.set_enabled(false);
    return next(message, (reply) => {
      const expired = ledger.expired;
      if (!ledger.acknowledge(operation)) return;
      if (!current(view)) {
        for (const [other, state] of views)
          if (other.g === this && state.active) {
            state.uncertain = false;
            requestCount(other, true);
          }
        return;
      }
      if (expired || views.get(view)?.uncertain) {
        views.get(view)!.uncertain = false;
        view.closeButton.set_enabled(true);
        view.g.blockHotkeys = false;
        view.buy1Button.set_enabled(false);
        view.buy10Button.set_enabled(false);
        requestCount(view, true);
        this.creditManager.refresh();
        return;
      }
      scoped(view, () => callback(reply));
      status(view, '');
    });
  });
  const captureOptions = <T>(options: T): T => {
    const view = scope;
    if (!view || !options || typeof options !== 'object') return options;
    const callback: unknown = Reflect.get(options, 'onComplete');
    if (typeof callback !== 'function') return options;
    const epoch = views.get(view)?.epoch;
    return Object.assign({}, options, {
      onComplete: function (this: unknown, ...args: unknown[]) {
        if (current(view) && views.get(view)?.epoch === epoch)
          return scoped(view, () => Reflect.apply(callback, this, args));
      },
    });
  };
  reflection.around(TweenMax, 'to', function (next, target, duration, options) {
    const tween = next(target, duration, captureOptions(options));
    if (scope) views.get(scope)?.tweens.add(tween);
    return tween;
  });
  reflection.around(TweenMax, 'from', function (next, ...args) {
    const tween = next(args[0], args[1], captureOptions(args[2]));
    if (scope) views.get(scope)?.tweens.add(tween);
    return tween;
  });
  reflection.around(TweenMax, 'delayedCall', function (next, delay, callback, params, useFrames) {
    const view = scope,
      epoch = view ? views.get(view)?.epoch : undefined;
    const tween = next(
      delay,
      (...values: unknown[]) => {
        if (!view) return Reflect.apply(callback, undefined, values);
        if (current(view) && views.get(view)?.epoch === epoch)
          return scoped(view, () => Reflect.apply(callback, undefined, values));
      },
      params,
      useFrames,
    );
    if (view) views.get(view)?.tweens.add(tween);
    return tween;
  });
  for (const method of [
    'animateReadyPod',
    'animateInPod',
    'animateOutPod',
    'animateOpenPod',
  ] as const) {
    reflection.around(PodState.prototype, method, function (next, pod, callback?: () => void) {
      const view = this,
        epoch = views.get(view)?.epoch;
      return scoped(view, () =>
        next(pod, () => {
          if (current(view) && views.get(view)?.epoch === epoch) scoped(view, () => callback?.());
        }),
      );
    });
  }
  const recover = (view: PodState) => {
    const state = views.get(view);
    if (!state || !current(view)) return;
    resetPresentation(view);
    if (state.recoveries++ > 0) {
      state.count.known = false;
      view.buy1Button.set_enabled(false);
      view.buy10Button.set_enabled(false);
      view.closeButton.set_enabled(true);
      view.g.blockHotkeys = false;
      status(
        view,
        'The pod display could not recover. Close this screen and reconnect before trying again.',
      );
      return;
    }
    requestCount(view, true);
    status(
      view,
      'The pod animation could not finish. Refreshing the count; check your inventory for a reward.',
    );
  };
  reflection.around(PodState.prototype, 'showLoot', function (next, reply, pod) {
    if (!current(this)) return;
    try {
      return next(reply, pod);
    } catch (error) {
      ClientErrorDiagnostics.record(error, 'Pod reward preview');
      TweenMax.killTweensOf(this.lootContainer);
      this.lootContainer.removeChildren(0, -1, true);
      this.lootContainer.set_visible(true);
      this.lootContainer.set_alpha(1);
      this.lootContainer.set_x(418);
      this.lootContainer.set_y(110);
      const label = ui.text(
        210,
        90,
        Localize.t('Pod opened.\nReward preview unavailable.\nCheck your inventory.'),
        12,
        0x8fd4ff,
        'center',
        RussoBitmapFontRegistry.fontNameForSize(12),
      );
      label.set_wordWrap(true);
      label.set_x(-105);
      this.lootContainer.addChild(label);
      try {
        this.g.creditManager.refresh();
      } catch (balanceError) {
        ClientErrorDiagnostics.record(balanceError, 'Pod credit refresh');
      }
      try {
        this.g.myCargo?.reloadCargoFromServer(() => {});
      } catch (balanceError) {
        ClientErrorDiagnostics.record(balanceError, 'Pod cargo refresh');
      }
    }
  });
  reflection.around(PodState.prototype, 'onOpenPod', function (next, reply, pod) {
    if (!current(this)) return;
    const state = views.get(this)!;
    let success = false;
    try {
      success = reply.length > 0 && reply.getBoolean(0);
    } catch {
      /* Reconcile malformed replies. */
    }
    if (!success) {
      requestCount(this, true);
      let reason = 'The pod could not be opened. Refreshing the count; check your inventory.';
      try {
        if (reply.length > 1) reason = reply.getString(1);
      } catch {
        /* Invalid error payload. */
      }
      this.g.showErrorDialog(reason);
      return;
    }
    state.deadline = performance.now() + 8000;
    try {
      return scoped(this, () => next(reply, pod));
    } catch {
      recover(this);
    }
  });
  for (const method of ['readyOpenPod', 'openingComplete'] as const)
    reflection.after(PodState.prototype, method, function () {
      const state = views.get(this);
      if (state) {
        state.deadline = 0;
        state.recoveries = 0;
      }
    });
  reflection.before(PodState.prototype, 'exit', function () {
    const state = views.get(this);
    if (state) {
      state.active = false;
      const confirmation = state.confirmation;
      state.confirmation = null;
      confirmation?.removeEventListeners('accept');
      confirmation?.removeEventListeners('close');
      confirmation?.close();
      state.count.dispose();
      for (const tween of state.tweens) tween.kill();
      state.tweens.clear();
      state.status?.removeFromParent(true);
    }
    views.delete(this);
  });
  api.defer(() => {
    for (const [view, state] of views) {
      view.closeButton.set_enabled(true);
      view.g.blockHotkeys = false;
      state.active = false;
      const confirmation = state.confirmation;
      state.confirmation = null;
      confirmation?.removeEventListeners('accept');
      confirmation?.removeEventListeners('close');
      confirmation?.close();
      state.count.dispose();
      for (const tween of state.tweens) tween.kill();
      state.tweens.clear();
      state.status?.removeFromParent(true);
    }
    views.clear();
  });
}
