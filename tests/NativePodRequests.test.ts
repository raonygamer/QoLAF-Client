import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativePodRequests } from '../src/pods/NativePodRequests';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('unanswered pod mutations survive screen changes and stale callbacks still report rewards', async (context) => {
  class Button extends Display {
    dispatched: string[] = [];
    dispatchEvent(event: { type: string }) {
      this.dispatched.push(event.type);
    }
    enabled = true;
    set_enabled(value: boolean) {
      this.enabled = value;
    }
  }
  class Text extends Display {
    constructor(
      _width?: number,
      _height?: number,
      public text = '',
    ) {
      super();
    }
    set_text(value: string) {
      this.text = value;
    }
    set_wordWrap() {}
    set_autoScale() {}
    set_pixelSnapping() {}
  }
  const popups: Box[] = [];
  class Box extends Display {
    removeEventListeners(type: string) {
      for (const listener of [...this.listeners(type)]) this.removeEventListener(type, listener);
    }
    closed = false;
    constructor(
      readonly game: Scene,
      readonly cost: number,
      readonly caption: string,
    ) {
      super();
    }
    close() {
      this.closed = true;
      this.dispatchEventWith('close');
    }
    accept() {
      this.dispatchEventWith('accept');
    }
  }
  const replies: Array<(response: object) => void> = [];
  const sent: string[] = [];
  class Scene {
    creditManager = { refresh: () => {} };
    blockHotkeys = false;
    addChildToOverlay(popup: Box) {
      popups.push(popup);
    }
    createMessage(type: string) {
      return { type, add: (_value: number) => {} };
    }
    get_connected() {
      return true;
    }
    get_isLeaving() {
      return false;
    }
    rpcMessage(message: { type: string }, callback: (response: object) => void) {
      sent.push(message.type);
      replies.push(callback);
    }
  }
  const animations: Array<{ killed: boolean; kill: () => void; fire: () => void }> = [];
  class Tween {
    static make(callback: () => void) {
      const tween = {
        killed: false,
        kill() {
          this.killed = true;
        },
        fire: callback,
      };
      animations.push(tween);
      return tween;
    }
    static killTweensOf(_target: object) {}
    static to(_target: object, _duration: number, options: { onComplete: () => void }) {
      return Tween.make(options.onComplete);
    }
    static from(_target: object, _duration: number, options: { onComplete: () => void }) {
      return Tween.make(options.onComplete);
    }
    static delayedCall(_delay: number, callback: () => void) {
      return Tween.make(callback);
    }
  }
  class View extends Display {
    buy1Button = new Button();
    buy10Button = new Button();
    closeButton = new Button();
    presented = 0;
    constructor(readonly g: Scene) {
      super();
    }
    pods: Display[] = [];
    podsContainer = new Display();
    lootContainer = new Display();
    tracks1 = new Display();
    tracks2 = new Display();
    nrOfPodsText = new Text();
    boughtPods = 0;
    currentPod: Display | null = null;
    initPodCount(reply: { getInt: () => number }) {
      this.boughtPods = reply.getInt();
      this.currentPod = this.boughtPods > 0 ? new Display() : null;
    }
    brokenPreview = false;
    showLoot() {
      if (this.brokenPreview) throw new Error('preview fixture failure');
    }
    onOpenPod() {}
    readyOpenPod() {}
    openingComplete() {}
    animateReadyPod(_pod?: Display, callback?: () => void) {
      Tween.to({}, 1, {
        onComplete: () => {
          Tween.delayedCall(0.1, () => callback?.());
        },
      });
    }
    animateInPod() {}
    animateOutPod() {}
    animateOpenPod() {}
    enter() {
      this.g.rpcMessage({ type: 'getPodCount' }, (reply) =>
        this.initPodCount(reply as { getInt: () => number }),
      );
    }
    execute() {}
    exit() {}
    buyPods(_count: number) {
      this.g.rpcMessage({ type: 'buyPod' }, () => {
        this.presented++;
      });
    }
    createClickOpenPod(_pod: Display | null) {
      return () =>
        this.g.rpcMessage({ type: 'openPod' }, () => {
          this.presented++;
        });
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const off = hooks.add(target, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const classes = {
    'starling.display.Button': Button,
    'core.hud.components.dialogs.CreditBuyBox': Box,
    'core.credits.CreditManager': { getCostPods: () => 25 },
    'generics.Localize': { t: (text: string) => text },
    'core.scene.Game': Scene,
    'core.states.gameStates.PodState': View,
    'com.greensock.TweenMax': Tween,
    'starling.text.TextField': Text,
    'starling.text.TextFormat': class {},
  };
  const api = {
    cls: (name: string) => Reflect.get(classes, name) ?? {},
    before: hook('before'),
    after: hook('after'),
    around: hook('around'),
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installNativePodRequests(api);
  let reported = 0;
  // Same registration order as NativeRewardNotices, after the request guard.
  cleanups.push(
    hooks.add(
      Scene.prototype,
      'rpcMessage',
      'around',
      function (
        next: Scene['rpcMessage'],
        message: { type: string },
        callback: (response: object) => void,
      ) {
        return next(message, (response) => {
          reported++;
          callback(response);
        });
      },
    ),
  );
  try {
    const replyCount = (count: number) => replies.shift()!({ length: 1, getInt: () => count });
    const game = new Scene();
    const first = new View(game);
    first.enter();
    replyCount(0);
    first.buy1Button.dispatchEvent({ type: 'addedToStage' });
    assert.deepEqual(first.buy1Button.dispatched, ['addedToStage']);
    const trigger = { type: 'triggered' };
    first.buy1Button.dispatchEvent(trigger);
    first.buy10Button.dispatchEvent(trigger);
    assert.equal(popups.length, 1, 'only one owned confirmation can open');
    assert.equal(popups[0].cost, 25);
    assert.equal(first.buy1Button.enabled, false);
    popups[0].close();
    assert.equal(first.buy1Button.enabled, true);
    assert.deepEqual(sent, ['getPodCount'], 'cancel does not purchase');
    first.buy1Button.dispatchEvent(trigger);
    popups[1].accept();
    first.buyPods(10);
    first.createClickOpenPod(first.currentPod)();
    assert.deepEqual(sent, ['getPodCount', 'buyPod']);
    assert.equal(first.boughtPods, 0, 'no invented purchased count before acknowledgement');
    let staleAnimation = 0;
    first.animateReadyPod(new Display(), () => staleAnimation++);
    animations[0].fire(); // Internal completion starts another delayed animation.
    assert.equal(animations.length, 2);
    first.exit();
    assert.equal(animations[1].killed, true, 'nested delayed animation belongs to the pod view');
    animations[1].fire();
    assert.equal(staleAnimation, 0, 'generation guard also rejects an already queued completion');
    const second = new View(game);
    second.enter();
    second.buyPods(1);
    second.createClickOpenPod(second.currentPod)();
    assert.equal(second.buy1Button.enabled, false);
    replies.shift()!({}); // Old purchase is acknowledged while the new count is pending.
    assert.equal(first.presented, 0);
    replyCount(0); // Predates acknowledgement: cannot become authoritative.
    second.buyPods(1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(sent, ['getPodCount', 'buyPod', 'getPodCount', 'getPodCount']);
    replyCount(1);
    second.createClickOpenPod(second.currentPod)();
    assert.equal(sent.at(-1), 'openPod');
    const reply = replies.shift()!;
    reply({});
    reply({});
    assert.equal(second.presented, 1, 'duplicate reply cannot present twice');
    assert.ok(reported >= 5, 'late replies still reach the downstream reward observer');
    second.exit();
    const third = new View(new Scene());
    third.enter();
    replyCount(0);
    third.brokenPreview = true;
    context.mock.method(console, 'error', () => {});
    assert.doesNotThrow(() => third.showLoot());
    const fallback = third.lootContainer.children[0] as Text;
    assert.equal(fallback.text, 'Pod opened.\nReward preview unavailable.\nCheck your inventory.');
    assert.equal(third.lootContainer.get_x(), 418);
    assert.equal(fallback.get_x(), -105);
    third.buy10Button.dispatchEvent(trigger);
    const last = popups.at(-1)!;
    assert.equal(last.cost, 250);
    third.exit();
    assert.equal(last.closed, true);
    const before = sent.length;
    last.accept();
    assert.equal(sent.length, before, 'closed confirmation cannot submit later');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});
