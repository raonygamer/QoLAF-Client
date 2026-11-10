import { read, type API, type Raw } from '../api/Types';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** SceneBase.canvasStars and ParallaxManager.starTarget from the original. */
export function installBackgroundLayers(game: Raw, session: API, settings: DeviceSettings): void {
  const background = game.canvasBackground;
  const parallax = game.parallaxManager;
  const Sprite = session.cls('starling.display.Sprite') as any;
  if (!background || !parallax?.starBatch || !Sprite) return;
  const nativeSettings = session.cls('core.scene.SceneBase')?.settings;
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
        else delete nativeSettings[key];
      });
    }
    session.before(nativeSettings, 'save', () => settings.flush());
  }
  session.defer(() => settings.flush());
  const stars = new Sprite();
  stars.set_name('canvasStars');
  const previousStars = Object.getOwnPropertyDescriptor(game, 'canvasStars');
  game.canvasStars = stars;
  const backgroundIndex = game.canvas.getChildIndex(background);
  game.canvas.addChildAt(stars, backgroundIndex + 1);
  const layer = { name: 'canvasStars', instance: stars, ratio: 1 };
  const layerIndex = game.layersInfo.findIndex((entry: Raw) => entry.instance === background);
  game.layersInfo.splice(layerIndex + 1, 0, layer);
  const originalAlpha = read(background, 'alpha');
  const originalVisible = read(background, 'visible');
  stars.set_visible(originalVisible);
  // The camera moves ratio-1 layers separately from the world canvas.
  stars.set_x(read(background, 'x'));
  stars.set_y(read(background, 'y'));

  const attachBatch = () => {
    if (parallax.initialized) stars.addChild(parallax.starBatch);
  };
  const applyBrightness = () => {
    background.set_alpha(settings.get('backgroundOpacity'));
    stars.set_alpha(settings.get('starBrightness'));
  };
  attachBatch();
  applyBrightness();
  session.defer(
    settings.subscribe((key) => {
      if (key === 'backgroundOpacity' || key === 'starBrightness') applyBrightness();
    }),
  );
  session.after(parallax, 'refresh', attachBatch);
  // Upstream clear disposes its entire target, including objects it reuses on
  // refresh. The original explicitly detaches its two owned containers instead.
  session.around(parallax, 'clear', function () {
    if (!this.initialized) return;
    this.nebulaContainer.removeFromParent();
    this.starBatch.removeFromParent();
    this.nebulaContainer.removeChildren(0, -1, true);
    this.starBatch.clear();
    for (const list of [this.nebulas, this.stars, this.miniStars, this.miniDusts]) list.length = 0;
    this.initialized = false;
  });
  session.after(background, 'set_visible', function (visible) {
    stars.set_visible(visible);
  });
  session.defer(() => {
    // Session cleanup runs before the upstream Game.exit disposes its canvas.
    if (read(parallax.starBatch, 'parent') === stars) background.addChild(parallax.starBatch);
    const index = game.layersInfo.indexOf(layer);
    if (index !== -1) game.layersInfo.splice(index, 1);
    stars.removeFromParent(true);
    background.set_alpha(originalAlpha);
    if (previousStars) Object.defineProperty(game, 'canvasStars', previousStars);
    else delete game.canvasStars;
  });
}
