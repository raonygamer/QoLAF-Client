import type {} from '../game/InitialWorld';
import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, PlayState, LandedState, Login } from '../game/Bindings';
import { initialGameIsAbandoned } from '../network/InitialGameConnection';
import { parallaxIsReady } from './ParallaxLoading';

const revealListeners = new WeakMap<GameScene, Set<() => void>>();

/** Observe the completed native fade, not just initialization packets. */
export function watchInitialWorld(scene: GameScene, completed: () => void): Cleanup {
  let listeners = revealListeners.get(scene);
  if (!listeners) {
    listeners = new Set();
    revealListeners.set(scene, listeners);
  }
  listeners.add(completed);
  return () => {
    listeners.delete(completed);
    if (listeners.size === 0) revealListeners.delete(scene);
  };
}

interface Reveal {
  loopStarted: boolean;
  revealed: boolean;
  scheduled: boolean;
  fading: boolean;
  waitingForState: boolean;
  backgroundTimedOut: boolean;
  welcomePending: boolean;
  drawingWelcome: boolean;
  previousHotkeys: boolean;
  timeout?: ReturnType<typeof setTimeout>;
  releaseFrame?: Cleanup;
  releaseFade?: Cleanup;
}

/** Original initial-world reveal, retaining native state and background rendering. */
export function installInitialWorld(api: API): void {
  const reflection = new GameReflection(api);
  const scenes = new Map<GameScene, Reveal>();
  const retired = new WeakSet<GameScene>();
  const stateFor = (scene: GameScene): Reveal => {
    let state = scenes.get(scene);
    if (!state) {
      state = {
        loopStarted: false,
        revealed: false,
        scheduled: false,
        fading: false,
        waitingForState: false,
        backgroundTimedOut: false,
        welcomePending: false,
        drawingWelcome: false,
        previousHotkeys: scene.blockHotkeys,
      };
      scenes.set(scene, state);
      const owner = state;
      state.timeout = setTimeout(() => {
        owner.timeout = undefined;
        owner.backgroundTimedOut = true;
        attempt(scene);
      }, 5000);
    }
    return state;
  };
  const ready = (scene: GameScene, state: Reveal): boolean =>
    !retired.has(scene) &&
    !scene.get_isLeaving() &&
    !initialGameIsAbandoned(scene) &&
    GameScene.instance === scene &&
    state.loopStarted &&
    !state.revealed &&
    !state.waitingForState &&
    scene.synchedEnemies &&
    !!scene.gameStateMachine?.currentState?.get_loaded() &&
    !!scene.parallaxManager &&
    (parallaxIsReady(scene.parallaxManager) || state.backgroundTimedOut);

  function attempt(scene: GameScene): void {
    const state = scenes.get(scene);
    if (!state || state.scheduled || state.fading || !ready(scene, state)) return;
    state.scheduled = true;
    const reveal = () => {
      state.releaseFrame?.();
      state.releaseFrame = undefined;
      state.scheduled = false;
      if (!ready(scene, state)) return;
      const cover = Login.fadeScreen;
      if (!cover) return;
      state.fading = true;
      scene.canvas?.set_visible(true);
      if (state.welcomePending) {
        state.welcomePending = false;
        state.drawingWelcome = true;
        try {
          scene.drawWelcomeText();
        } finally {
          state.drawingWelcome = false;
        }
      }
      const detach = () => {
        cover.removeEventListener('fadeOutComplete', completed);
        cover.removeEventListener('fadeOutCancelled', cancelled);
        state.releaseFade = undefined;
      };
      const completed = () => {
        detach();
        state.fading = false;
        if (
          retired.has(scene) ||
          scene.get_isLeaving() ||
          initialGameIsAbandoned(scene) ||
          !scene.get_connected() ||
          GameScene.instance !== scene
        )
          return;
        state.revealed = true;
        clearTimeout(state.timeout);
        scene.blockHotkeys = false;
        for (const listener of [...(revealListeners.get(scene) ?? [])]) listener();
      };
      const cancelled = () => {
        detach();
        state.fading = false;
        state.waitingForState = true;
      };
      state.releaseFade = detach;
      cover.addEventListener('fadeOutComplete', completed);
      cover.addEventListener('fadeOutCancelled', cancelled);
      cover.fadeOut();
    };
    // The native update listener is registered by runGameLoop before this one.
    scene.addEventListener('enterFrame', reveal);
    state.releaseFrame = () => scene.removeEventListener('enterFrame', reveal);
  }
  const extensions = {
    get_initialWorldIsRevealed(this: GameScene): boolean {
      return scenes.get(this)?.revealed === true;
    },
    tryRevealInitialWorld(this: GameScene): void {
      const state = scenes.get(this);
      if (state) state.waitingForState = false;
      attempt(this);
    },
  };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries(extensions)) {
    previous.set(name, Object.getOwnPropertyDescriptor(GameScene.prototype, name));
    Object.defineProperty(GameScene.prototype, name, { configurable: true, writable: true, value });
  }
  api.defer(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(GameScene.prototype, name, descriptor);
      else Reflect.deleteProperty(GameScene.prototype, name);
    }
  });
  reflection.before(GameScene.prototype, 'init', function () {
    stateFor(this);
  });
  reflection.after(GameScene.prototype, 'init', function () {
    this.blockHotkeys = true;
  });
  reflection.around(GameScene.prototype, 'runGameLoop', function (next) {
    if (retired.has(this) || this.get_isLeaving() || initialGameIsAbandoned(this)) return;
    const state = stateFor(this);
    if (state.loopStarted) return;
    state.loopStarted = true;
    next();
    attempt(this);
  });
  reflection.after(GameScene.prototype, 'update', function () {
    attempt(this);
  });
  reflection.after(GameScene.prototype, 'onInitSyncEnemies', function () {
    attempt(this);
  });
  for (const State of [PlayState, LandedState]) {
    reflection.around(State.prototype, 'loadCompleted', function (next) {
      if (retired.has(this.g) || this.g.get_isLeaving() || initialGameIsAbandoned(this.g)) return;
      const state = stateFor(this.g);
      if (state.revealed) return next();
      this._loaded = true;
      state.waitingForState = false;
      attempt(this.g);
    });
  }
  reflection.around(GameScene.prototype, 'drawWelcomeText', function (next) {
    if (retired.has(this) || this.get_isLeaving() || initialGameIsAbandoned(this)) return;
    const state = stateFor(this);
    if (state.revealed || state.drawingWelcome) next();
    else state.welcomePending = true;
  });
  for (const method of ['tryOpenTOSPopup', 'tryOpenSaleSpinner'] as const) {
    reflection.around(GameScene.prototype, method, function (next) {
      if (scenes.get(this)?.revealed) next();
    });
  }
  const release = (scene: GameScene) => {
    const state = scenes.get(scene);
    if (!state) return;
    clearTimeout(state.timeout);
    state.releaseFrame?.();
    state.releaseFade?.();
    scenes.delete(scene);
  };
  reflection.before(GameScene.prototype, 'exit', function () {
    retired.add(this);
    release(this);
  });
  reflection.before(GameScene.prototype, 'dispose', function () {
    retired.add(this);
    release(this);
  });
  api.defer(() => {
    for (const [scene, state] of scenes) {
      release(scene);
      if (!scene.get_isLeaving() && GameScene.instance === scene && !state.revealed) {
        scene.blockHotkeys = state.previousHotkeys;
        Login.fadeScreen?.fadeOut();
      }
    }
  });
}
