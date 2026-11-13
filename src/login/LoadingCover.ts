import type {} from '../game/LoadingCover';
import { CoverPresentation } from './CoverPresentation';
import type { Message, TimerEvent } from '../game/Bindings';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Event, FadeScreen, Login, Starling, TopPvPPlayersList } from '../game/Bindings';

interface Fade {
  frame: () => void;
  fallback: ReturnType<typeof setTimeout>;
}

/** Source FadeScreen transitions on the existing native loading screen. */
export function installLoadingCover(api: API): void {
  const reflection = new GameReflection(api);
  const fades = new Map<FadeScreen, Fade>();
  const fadeIns = new Map<FadeScreen, Fade>();
  const visibleCovers = new Set<FadeScreen>();
  const revealOnShow = new WeakSet<FadeScreen>();
  const finishing = new WeakSet<FadeScreen>();
  const disposed = new WeakSet<FadeScreen>();
  const staticCovers = new WeakSet<FadeScreen>();
  const pendingHighscores = new WeakMap<FadeScreen, Message>();
  const presentations = new Map<FadeScreen, CoverPresentation>();

  const bringToFront = (cover: FadeScreen) => {
    if (!cover.stage.contains(cover.screen)) cover.stage.addChild(cover.screen);
    const last = cover.stage.get_numChildren() - 1;
    if (cover.stage.getChildAt(last) !== cover.screen)
      cover.stage.setChildIndex(cover.screen, last);
    visibleCovers.add(cover);
  };
  const stopFadeIn = (cover: FadeScreen) => {
    const fade = fadeIns.get(cover);
    if (!fade) return;
    clearTimeout(fade.fallback);
    cover.stage.removeEventListener('enterFrame', fade.frame);
    fadeIns.delete(cover);
  };
  const reveal = (cover: FadeScreen) => {
    stopFadeIn(cover);
    const start = performance.now();
    cover.screen.set_alpha(0);
    const finish = () => {
      stopFadeIn(cover);
      if (!disposed.has(cover)) cover.screen.set_alpha(1);
    };
    const frame = () => {
      const progress = Math.max(0, Math.min(1, (performance.now() - start) / 250));
      cover.screen.set_alpha(1 - (1 - progress) * (1 - progress));
      if (progress === 1) finish();
    };
    fadeIns.set(cover, { frame, fallback: setTimeout(finish, 500) });
    cover.stage.addEventListener('enterFrame', frame);
  };
  // Game-state entry can append HUD/overlay nodes after show(). Reassert order
  // at render time, after all simulation and scene-entry callbacks have run.
  reflection.before(Starling.prototype, 'render', function () {
    for (const cover of visibleCovers) {
      if (
        disposed.has(cover) ||
        !cover.screen.get_visible() ||
        !cover.stage.contains(cover.screen)
      ) {
        visibleCovers.delete(cover);
        continue;
      }
      if (this.get_stage() === cover.stage) bringToFront(cover);
    }
  });
  const stop = (cover: FadeScreen): boolean => {
    const fade = fades.get(cover);
    if (!fade) return false;
    fades.delete(cover);
    clearTimeout(fade.fallback);
    cover.stage.removeEventListener('enterFrame', fade.frame);
    cover.fadeOutTimer.stop();
    cover.fadeOutTimer.reset();
    return true;
  };
  const cancel = (cover: FadeScreen) => {
    if (stop(cover)) cover.dispatchEvent(new Event('fadeOutCancelled'));
  };
  const complete = (cover: FadeScreen) => {
    if (!stop(cover) || disposed.has(cover)) return;
    visibleCovers.delete(cover);
    cover.loadingText.set_visible(false);
    cover.screenText.stop();
    cover.screenText.set_visible(false);
    cover.stage.removeEventListener('enterFrame', reflection.bound(cover, cover.update));
    finishing.add(cover);
    try {
      // Native completion owns the PvP list, promotion overlay and event dispatch.
      cover.onFadeOutTimerComplete(null);
    } finally {
      finishing.delete(cover);
    }
  };

  const prepareStatic = (cover: FadeScreen) => {
    if (disposed.has(cover)) return;
    if (!staticCovers.has(cover)) pendingHighscores.delete(cover);
    staticCovers.add(cover);
    stopFadeIn(cover);
    cancel(cover);
    cover.fadeInTimer.stop();
    cover.fadeInTimer.reset();
    cover.stage.removeEventListener('enterFrame', reflection.bound(cover, cover.update));
    cover.screenText.stop();
    cover.screenText.set_visible(false);
    cover.loadingText.set_visible(false);
    cover.loadingImage.set_visible(false);
    cover.loadingImage2.set_visible(false);
    cover.topPvpPlayersList?.set_visible(false);
    const overlay = Starling.get_current()?.get_nativeOverlay();
    if (cover.promotionButton && overlay?.contains(cover.promotionButton))
      overlay.removeChild(cover.promotionButton);
    cover.screen.set_alpha(1);
    cover.screen.set_visible(true);
    bringToFront(cover);
  };
  const methods = {
    get_isCoverVisible(this: FadeScreen): boolean {
      return this.screen.get_visible() && this.stage.contains(this.screen);
    },
    showStaticCover(this: FadeScreen): void {
      prepareStatic(this);
      const renderer = Starling.get_current();
      if (renderer?.get_contextValid()) renderer.setRequiresRedraw();
    },
    showStaticCoverUntilPresented(this: FadeScreen, callback: () => void): number {
      if (disposed.has(this)) return 0;
      let presentation = presentations.get(this);
      if (!presentation) {
        presentation = new CoverPresentation();
        presentations.set(this, presentation);
      }
      return presentation.start(
        () => {
          const wasOpaque =
            this.stage.contains(this.screen) &&
            this.screen.get_visible() &&
            this.screen.get_alpha() === 1;
          prepareStatic(this);
          if (!wasOpaque) reveal(this);
        },
        callback,
        () => this.screen.get_alpha() === 1,
      );
    },
    cancelStaticCoverWait(this: FadeScreen, token: number): void {
      presentations.get(this)?.cancel(token);
    },
    resumeLoadingAfterTeardown(this: FadeScreen, restartTip = true): void {
      if (disposed.has(this)) return;
      const highscore = pendingHighscores.get(this);
      pendingHighscores.delete(this);
      staticCovers.delete(this);
      const restore = !restartTip
        ? reflection.around(this.screenText, 'start', function () {})
        : undefined;
      try {
        this.show();
      } finally {
        restore?.();
      }
      if (!restartTip) {
        this.screenText.stop();
        this.screenText.set_visible(false);
      }
      if (highscore) this.showHighscore(highscore);
    },
  };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, method] of Object.entries(methods)) {
    previous.set(name, Object.getOwnPropertyDescriptor(FadeScreen.prototype, name));
    Object.defineProperty(FadeScreen.prototype, name, {
      configurable: true,
      writable: true,
      value: method,
    });
  }
  api.defer(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(FadeScreen.prototype, name, descriptor);
      else Reflect.deleteProperty(FadeScreen.prototype, name);
    }
  });

  for (const method of ['show', 'fadeIn'] as const) {
    reflection.before(FadeScreen.prototype, method, function () {
      if (method === 'show') {
        staticCovers.delete(this);
        pendingHighscores.delete(this);
        if (Login.START_SETUP_IS_ACTIVE) return;
      }
      if (
        method === 'show' &&
        (!this.stage.contains(this.screen) ||
          !this.screen.get_visible() ||
          this.screen.get_alpha() < 1)
      )
        revealOnShow.add(this);
      stopFadeIn(this);
      cancel(this);
      if (method === 'fadeIn') bringToFront(this);
    });
    reflection.after(FadeScreen.prototype, method, function () {
      if (method === 'show' && Login.START_SETUP_IS_ACTIVE) return;
      if (this.screen.get_visible()) bringToFront(this);
    });
  }
  reflection.after(FadeScreen.prototype, 'show', function () {
    if (Login.START_SETUP_IS_ACTIVE || !this.screen.get_visible() || disposed.has(this)) return;
    // start() does not clear ScreenTextField.stopPlaying in the Haxe runtime.
    this.screenText.play();
    this.loadingImage.set_visible(true);
    this.loadingImage.set_alpha(1);
    this.loadingImage2.set_visible(true);
    this.loadingImage2.set_alpha(0);
    if (revealOnShow.delete(this)) reveal(this);
  });
  reflection.around(FadeScreen.prototype, 'showHighscore', function (_next, message) {
    if (staticCovers.has(this)) {
      pendingHighscores.set(this, message);
      return;
    }
    if (
      disposed.has(this) ||
      fades.has(this) ||
      presentations.get(this)?.isWaiting ||
      !this.screen.get_visible() ||
      !this.stage.contains(this.screen)
    )
      return;
    const pages = this.textsPvp[Math.floor(Math.random() * (this.textsPvp.length - 0.1))];
    this.screenText.play();
    this.screenText.start(pages);
    this.topPvpPlayersList?.removeFromParent(true);
    const list = new TopPvPPlayersList();
    this.topPvpPlayersList = list;
    list.showHighscore(message);
    this.screen.addChild(list);
    list.set_x(this.stage.get_stageWidth() / 2 - list.get_width() / 2);
    list.set_y(this.stage.get_stageHeight() / 2 - list.get_height() / 2);
    this.loadingImage.set_alpha(0);
    this.loadingImage2.set_alpha(1);
  });
  reflection.around(FadeScreen.prototype, 'repositionScreen', function () {
    bringToFront(this);
  });
  reflection.around(FadeScreen.prototype, 'fadeOut', function () {
    if (disposed.has(this) || fades.has(this)) return;
    stopFadeIn(this);
    staticCovers.delete(this);
    pendingHighscores.delete(this);
    const overlay = Starling.get_current()?.get_nativeOverlay();
    if (this.promotionButton && overlay?.contains(this.promotionButton))
      overlay.removeChild(this.promotionButton);
    this.fadeInTimer.stop();
    this.fadeInTimer.reset();
    this.fadeOutTimer.stop();
    this.fadeOutTimer.reset();
    const start = performance.now();
    const alpha = this.screen.get_alpha();
    const frame = () => {
      const progress = Math.min(1, Math.max(0, (performance.now() - start) / 250));
      // TweenMax's default Quad.easeOut, retaining the cover's current alpha.
      this.screen.set_alpha(alpha * (1 - progress) * (1 - progress));
      if (progress === 1) complete(this);
    };
    const wasAttached = this.stage.contains(this.screen);
    fades.set(this, { frame, fallback: setTimeout(() => complete(this), 500) });
    if (!wasAttached) {
      complete(this);
      return;
    }
    bringToFront(this);
    this.stage.addEventListener('enterFrame', frame);
  });
  // Native timers can have an already-queued event when a transition is replaced.
  reflection.around(FadeScreen.prototype, 'onFadeOutTimerUpdate', function () {});
  reflection.around(FadeScreen.prototype, 'onFadeOutTimerComplete', function (next, event) {
    if (finishing.has(this)) next(event);
    else if (fades.has(this)) complete(this);
  });
  reflection.around(FadeScreen.prototype, 'dispose', function () {
    if (disposed.has(this)) return;
    disposed.add(this);
    visibleCovers.delete(this);
    stopFadeIn(this);
    presentations.get(this)?.cancel();
    presentations.delete(this);
    staticCovers.delete(this);
    pendingHighscores.delete(this);
    cancel(this);
    this.screenText.stop();
    this.fadeInTimer.stop();
    this.fadeInTimer.reset();
    this.fadeOutTimer.stop();
    this.fadeOutTimer.reset();
    this.fadeInTimer.removeEventListener('timer', reflection.bound(this, this.onFadeInTimerUpdate));
    this.fadeInTimer.removeEventListener(
      'timerComplete',
      reflection.bound(this, this.onFadeInTimerComplete),
    );
    this.fadeOutTimer.removeEventListener(
      'timer',
      reflection.bound(this, this.onFadeOutTimerUpdate),
    );
    this.fadeOutTimer.removeEventListener<TimerEvent>(
      'timerComplete',
      reflection.bound(this, this.onFadeOutTimerComplete),
    );
    this.screenText.removeFromParent(true);
    this.screen.removeFromParent();
    const overlay = Starling.get_current()?.get_nativeOverlay();
    if (this.promotionButton && overlay?.contains(this.promotionButton))
      overlay.removeChild(this.promotionButton);
    if (this.topPvpPlayersList) {
      this.topPvpPlayersList.dispose();
      this.topPvpPlayersList = null;
    }
    this.stage.removeEventListener('enterFrame', reflection.bound(this, this.update));
    this.stage.removeEventListener('resize', reflection.bound(this, this.resize));
    this.bgrQuad.dispose();
  });
  api.defer(() => {
    for (const presentation of presentations.values()) presentation.cancel();
    presentations.clear();
    for (const cover of [...fadeIns.keys()]) {
      stopFadeIn(cover);
      if (!disposed.has(cover)) cover.screen.set_alpha(1);
    }
    visibleCovers.clear();
    for (const cover of [...fades.keys()]) complete(cover);
  });
}
