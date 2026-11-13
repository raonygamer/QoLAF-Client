import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  GameScene,
  WarpJumpState,
  PlayState,
  GlowFilter,
  TweenMax,
  type FragmentFilter,
  type DisplayObject,
} from '../game/Bindings';
import { initialGameIsAbandoned } from '../network/InitialGameConnection';

interface Visuals {
  completed: boolean;
  cleaned: boolean;
  parallaxGlow: boolean;
  trackStep: number;
  originalFilter: FragmentFilter | null;
  clip: DisplayObject | null;
  glow?: GlowFilter;
}

/** Original ten-times-faster warp and ownership-aware visual cleanup. */
export function installWarpAnimation(api: API): void {
  const reflection = new GameReflection(api);
  const visuals = new Map<WarpJumpState, Visuals>();
  const clearGlow = (state: WarpJumpState, visual: Visuals) => {
    if (visual.parallaxGlow) {
      state.g.parallaxManager?.removeGlow();
      visual.parallaxGlow = false;
    }
    if (visual.glow) {
      if (visual.clip?.get_filter() === visual.glow) visual.clip.set_filter(visual.originalFilter);
      visual.glow.dispose();
      visual.glow = undefined;
    }
  };
  const cleanup = (state: WarpJumpState) => {
    const visual = visuals.get(state);
    if (!visual || visual.cleaned) return;
    visual.cleaned = true;
    TweenMax.killTweensOf(state.darkOverlay);
    clearGlow(state, visual);
    if (state.g.camera) state.g.camera.trackStep = visual.trackStep;
    state.darkOverlay.removeFromParent(true);
    state.flashOverlay.removeFromParent(true);
  };
  reflection.around(WarpJumpState.prototype, 'enter', function (next) {
    const clip = this.g.get_me()?.ship?.get_movieClip() ?? null;
    visuals.set(this, {
      completed: false,
      cleaned: false,
      parallaxGlow: false,
      trackStep: this.g.camera?.trackStep ?? 5,
      originalFilter: clip?.get_filter() ?? null,
      clip,
    });
    // The native constructor records creation time + 10 seconds. Preserve the
    // creation-time anchor, using the original client's one-second fallback.
    this.timeout -= 9000;
    next();
    // The original client removed the native white flash and ship stretching.
    this.flashOverlay.removeFromParent();
  });
  reflection.around(WarpJumpState.prototype, 'execute', function (next) {
    const visual = visuals.get(this);
    if (!visual) return next();
    if (visual.cleaned || this.g.get_isLeaving() || initialGameIsAbandoned(this.g)) return;
    if (
      !this.hyperDriveEngaged &&
      ((this.ship?.get_speed().get_length() ?? 0) >= 800 || this.timeout < this.g.time)
    ) {
      this.hyperDriveEngaged = true;
      if (this.g.camera) this.g.camera.trackStep = 100;
      if (this.g.parallaxManager) {
        this.g.parallaxManager.glow();
        visual.parallaxGlow = true;
      }
      if (visual.clip) {
        visual.glow = new GlowFilter(0xffffff, 1, 20);
        visual.clip.set_filter(visual.glow);
      }
      TweenMax.to(this.darkOverlay, 0.1, {
        alpha: 1,
        onComplete: () => {
          if (visual.cleaned || this.g.get_isLeaving() || initialGameIsAbandoned(this.g)) return;
          clearGlow(this, visual);
          this.warpJump();
        },
      });
    }
    PlayState.prototype.execute.call(this);
  });
  reflection.around(WarpJumpState.prototype, 'warpJump', function (next) {
    const visual = visuals.get(this);
    if (!visual) return next();
    if (
      visual.completed ||
      visual.cleaned ||
      this.g.get_isLeaving() ||
      initialGameIsAbandoned(this.g)
    )
      return;
    visual.completed = true;
    next();
  });
  reflection.before(WarpJumpState.prototype, 'exit', function () {
    cleanup(this);
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    for (const state of visuals.keys()) {
      if (state.g === this) {
        cleanup(state);
        visuals.delete(state);
      }
    }
  });
  api.defer(() => {
    for (const state of visuals.keys()) cleanup(state);
    visuals.clear();
  });
}
