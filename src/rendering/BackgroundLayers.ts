import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Sprite, SceneBase, IntroState, type GameScene } from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** SceneBase.canvasStars and ParallaxManager.starTarget from the original. */
export function installBackgroundLayers(
  game: GameScene,
  session: API,
  settings: DeviceSettings,
): void {
  const background = game.canvasBackground;
  const parallax = game.parallaxManager;
  const canvas = game.canvas;
  if (!background || !parallax || !canvas) return;
  const reflection = new GameReflection(session);
  const nativeSettings = SceneBase.settings;
  if (nativeSettings) {
    for (const key of ['backgroundOpacity', 'starBrightness'] as const) {
      const previous = Object.getOwnPropertyDescriptor(nativeSettings, key);
      Object.defineProperty(nativeSettings, key, {
        configurable: true,
        get: () => settings.get(key),
        set: (value: number) => settings.set(key, value),
      });
      session.defer(() => {
        if (previous) Object.defineProperty(nativeSettings, key, previous);
        else Reflect.deleteProperty(nativeSettings, key);
      });
    }
    reflection.before(nativeSettings, 'save', () => settings.flush());
  }
  session.defer(() => settings.flush());
  const stars = new Sprite();
  stars.set_name('canvasStars');
  const previousStars = Object.getOwnPropertyDescriptor(game, 'canvasStars');
  Object.defineProperty(game, 'canvasStars', { configurable: true, writable: true, value: stars });
  const backgroundIndex = canvas.getChildIndex(background);
  canvas.addChildAt(stars, backgroundIndex + 1);
  const layer = { name: 'canvasStars', instance: stars, ratio: 1 };
  const layerIndex = game.layersInfo.findIndex((entry) => entry.instance === background);
  game.layersInfo.splice(layerIndex + 1, 0, layer);
  const originalAlpha = background.get_alpha();
  const originalVisible = background.get_visible();
  stars.set_visible(originalVisible);
  // The camera moves ratio-1 layers separately from the world canvas.
  stars.set_x(background.get_x());
  stars.set_y(background.get_y());

  const attachBatch = () => {
    if (parallax.initialized) stars.addChild(parallax.starBatch);
  };
  const activeState = game.gameStateMachine?.currentState;
  let intro: IntroState | null = activeState instanceof IntroState ? activeState : null;
  let introAlpha = intro ? Math.max(0, Math.min(1, originalAlpha)) : 0;
  const applyBrightness = () => {
    if (!intro) background.set_alpha(settings.get('backgroundOpacity'));
    stars.set_alpha(settings.get('starBrightness') * (intro ? introAlpha : 1));
  };
  reflection.before(IntroState.prototype, 'enter', function () {
    if (this.g !== game) return;
    intro = this;
    introAlpha = 0;
    stars.set_alpha(0);
  });
  // The native voice preload starts the background tween asynchronously. Follow
  // that tween's alpha so both layers share its delay, duration and easing.
  reflection.after(background, 'set_alpha', function () {
    if (!intro) return;
    introAlpha = Math.max(0, Math.min(1, background.get_alpha()));
    stars.set_alpha(settings.get('starBrightness') * introAlpha);
  });
  for (const method of ['enterRoaming', 'exit'] as const)
    reflection.before(IntroState.prototype, method, function () {
      if (intro !== this) return;
      intro = null;
      stars.set_alpha(settings.get('starBrightness'));
    });
  attachBatch();
  applyBrightness();
  session.defer(
    settings.subscribe((key) => {
      if (key === 'backgroundOpacity' || key === 'starBrightness') applyBrightness();
    }),
  );
  reflection.after(parallax, 'refresh', attachBatch);
  reflection.after(background, 'set_visible', function (visible) {
    stars.set_visible(visible);
  });
  session.defer(() => {
    intro = null;
    // Session cleanup runs before the upstream Game.exit disposes its canvas.
    if (parallax.starBatch.get_parent() === stars) background.addChild(parallax.starBatch);
    const index = game.layersInfo.indexOf(layer);
    if (index !== -1) game.layersInfo.splice(index, 1);
    stars.removeFromParent(true);
    background.set_alpha(originalAlpha);
    if (previousStars) Object.defineProperty(game, 'canvasStars', previousStars);
    else Reflect.deleteProperty(game, 'canvasStars');
  });
}
