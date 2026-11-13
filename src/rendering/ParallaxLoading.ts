import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  ParallaxManager,
  TextureManager,
  TextureLocator,
  DataLocator,
  SceneBase,
  GameScene,
  StartSetup,
  Image,
  Random,
} from '../game/Bindings';
import { BackgroundAtlasCache } from './BackgroundAtlasCache';
import { BackgroundAtlasLoads } from './BackgroundAtlasLoads';

interface Loading {
  layout?: string;
  resolved: boolean;
  pending: boolean;
  ready: boolean;
  builtVisible?: boolean;
  callbacks: Set<() => void>;
  cancel?: Cleanup;
  release?: Cleanup;
}

const readiness = new WeakMap<ParallaxManager, Loading>();
export function parallaxIsReady(manager: ParallaxManager): boolean {
  return readiness.get(manager)?.ready ?? manager.initialized;
}

/** Source load generations, background visibility gating and resident-star fallback. */
export function installParallaxLoading(api: API): void {
  const reflection = new GameReflection(api);
  const cache = new BackgroundAtlasCache(reflection);
  const loader = new BackgroundAtlasLoads(cache);
  const states = new Map<ParallaxManager, Loading>();
  const retired = new WeakSet<ParallaxManager>();
  const stateFor = (manager: ParallaxManager): Loading => {
    let state = states.get(manager);
    if (!state) {
      state = { resolved: manager.g === null, pending: false, ready: false, callbacks: new Set() };
      states.set(manager, state);
      readiness.set(manager, state);
    }
    return state;
  };
  const visible = (manager: ParallaxManager) =>
    manager.g && SceneBase.settings ? SceneBase.settings.get_showBackground() : manager.visible;
  const flush = (state: Loading) => {
    if (!state.ready) return;
    const callbacks = [...state.callbacks];
    state.callbacks.clear();
    let failed = false;
    let firstError: unknown;
    for (const callback of callbacks) {
      try {
        callback();
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    }
    if (failed) throw firstError;
  };
  const build = (manager: ParallaxManager, state: Loading) => {
    if (retired.has(manager) || !state.layout || !state.resolved) return;
    const show = visible(manager);
    if (state.ready && manager.initialized && state.builtVisible === show) return flush(state);
    state.ready = false;
    manager.visible = show;
    if (show && state.pending && !manager.nebulaTxt) return;
    const star = manager.starTxt;
    if (!star) {
      if (!show) {
        manager.clear();
        state.builtVisible = false;
        state.ready = true;
        flush(state);
      }
      return;
    }
    manager.clear();
    if (show && manager.nebulaTxt) {
      for (let index = 0; index < manager.NEBULAS; index++) {
        const image = new Image(manager.nebulaTxt);
        image.set_blendMode('add');
        image.set_pivotX(image.get_width() / 2);
        image.set_pivotY(image.get_height() / 2);
        if (manager.isIntro) image.set_alpha(0);
        manager.nebulas.push(image);
        manager.nebulaContainer.addChild(image);
      }
      manager.nebulaUpdateCount = manager.NEBULA_UPDATE_INTERVAL;
    }
    for (let index = 0; index < 40; index++) manager.stars.push(new Image(star));
    for (let index = 0; index < 70; index++) manager.miniStars.push(new Image(star));
    for (let index = 0; index < 25; index++) manager.miniDusts.push(new Image(star));
    manager.target.addChild(manager.nebulaContainer);
    manager.target.addChild(manager.starBatch);
    manager.initialized = true;
    manager.resize();
    state.builtVisible = show;
    state.ready = true;
    flush(state);
  };
  reflection.around(ParallaxManager.prototype, 'load', function (_next, system, callback) {
    if (retired.has(this)) return;
    const image = DataLocator.getService().loadKey('Images', system.background);
    if (!image) throw new Error(`Missing background image data: ${system.background}`);
    const layout = [system.background, image.fileName, system.x, system.y, system.galaxy].join('|');
    const previous = stateFor(this);
    if (previous.layout === layout && (previous.ready || previous.pending)) {
      if (callback) previous.callbacks.add(callback);
      flush(previous);
      return;
    }
    previous.cancel?.();
    previous.release?.();
    previous.callbacks.clear();
    const state: Loading = {
      layout,
      resolved: previous.resolved,
      ready: false,
      pending: true,
      callbacks: new Set(),
    };
    if (callback) state.callbacks.add(callback);
    states.set(this, state);
    readiness.set(this, state);
    const textures = TextureLocator.getService();
    this.clear();
    this.starTxt = textures.getTextureMainByTextureName('star.png');
    this.nebulaTxt = null;
    this.nebulaType = image.textureName;
    this.random = new Random(system.x * system.y + system.x + system.y);
    this.NEBULAS = system.galaxy === 'Rapir System' ? 4 : 8;
    if (state.resolved) this.refresh();
    if (retired.has(this) || states.get(this) !== state) return;
    state.cancel = loader.request(textures, image.textureName, image.fileName, (loaded) => {
      if (retired.has(this) || states.get(this) !== state) return;
      state.pending = false;
      if (loaded) state.release = cache.acquire(image.fileName);
      this.starTxt = textures.getTextureMainByTextureName('star.png');
      this.nebulaTxt = loaded
        ? textures.getTextureByTextureName(image.textureName, image.fileName)
        : null;
      // Route through refresh so the star-layer attachment hooks run after a build.
      if (state.resolved) this.refresh();
    });
  });
  reflection.around(ParallaxManager.prototype, 'refresh', function () {
    if (retired.has(this)) return;
    const state = stateFor(this);
    if (!this.g || SceneBase.settings) state.resolved = true;
    build(this, state);
  });
  reflection.around(TextureManager.prototype, 'disposeCustomTextures', function (next) {
    cache.preserveDuring(next);
  });
  const release = (manager: ParallaxManager | null) => {
    if (!manager) return;
    retired.add(manager);
    const state = states.get(manager);
    state?.cancel?.();
    state?.release?.();
    state?.callbacks.clear();
    if (state) state.ready = false;
    states.delete(manager);
  };
  reflection.before(GameScene.prototype, 'exit', function () {
    release(this.parallaxManager);
  });
  reflection.before(GameScene.prototype, 'dispose', function () {
    release(this.parallaxManager);
  });
  reflection.before(StartSetup.prototype, 'dispose', function () {
    this.isRunning = false;
    const manager = this.pm;
    release(manager);
    if (manager) {
      manager.clear();
      // These objects are manager-owned; detach before the screen disposes
      // its children so shared ownership cannot dispose them twice.
      manager.nebulaContainer.removeFromParent();
      manager.starBatch.removeFromParent();
      manager.nebulaContainer.dispose();
      manager.starBatch.dispose();
      manager.starTxt = null;
      manager.nebulaTxt = null;
      manager.g = null;
      this.pm = null;
    }
  });
  // Prefetch changes only shared texture data, never the outgoing display list.
  reflection.before(GameScene.prototype, 'fadeIntoState', function (state) {
    if (!reflection.is(state, 'core.states.gameStates.WarpJumpState')) return;
    const system = DataLocator.getService().loadKey('SolarSystems', state.destination);
    if (!system) return;
    const image = DataLocator.getService().loadKey('Images', system.background);
    if (!image?.textureName || !image.fileName) return;
    loader.request(TextureLocator.getService(), image.textureName, image.fileName, () => {});
  });
  api.defer(() => {
    loader.dispose();
    for (const manager of states.keys()) {
      release(manager);
      readiness.delete(manager);
    }
  });
}
