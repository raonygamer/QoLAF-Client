import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeviceSettings } from '../src/settings/DeviceSettings';
import { installBackgroundLayers } from '../src/rendering/BackgroundLayers';
import { Display, Game, registry } from './fixtures/NativeGame';
// @ts-expect-error actual host loader
import { PluginHost } from './fixtures/HostCore.js';
// @ts-expect-error extracted upstream refresh/clear implementation
import methods from './fixtures/UpstreamParallax.js';

test('device settings retain original defaults, star migration, validation and local persistence', () => {
  let saved: any = { backgroundOpacity: 0.7, autoRespawn: false, dpiScale: 5, cameraZoom: 10 };
  let writes = 0;
  const settings = new DeviceSettings({
    get: () => saved,
    set: (_key, value) => {
      saved = value;
      writes++;
    },
  });
  assert.equal(settings.get('starBrightness'), 0.7);
  assert.equal(settings.get('disableSpaceToRespawn'), false);
  assert.equal(settings.get('dpiScale'), 1);
  assert.equal(settings.get('cameraZoom'), 2);
  assert.equal(settings.get('renderFrameRate'), 241);
  settings.flush();
  assert.equal(writes, 0);
  settings.set('starBrightness', 2);
  settings.flush();
  assert.equal(writes, 1);
  assert.equal(saved.starBrightness, 1);
  assert.equal(saved.backgroundOpacity, 0.7);
  settings.flush();
  assert.equal(writes, 1);
});

test('separate stars survive real upstream refresh twice and restore ownership on room exit', async (t) => {
  class Image extends Display {
    set_pivotX(_value: number) {}
    set_pivotY(_value: number) {}
  }
  class Batch extends Display {
    clear() {}
  }
  const definitions = registry();
  const nativeSettings = { get_showBackground: () => true, save() {} };
  definitions['core.scene.SceneBase'].settings = nativeSettings;
  const upstream = methods(
    Image,
    { settings: nativeSettings },
    { write() {} },
    { delayedCall() {} },
  );
  const background = new Display();
  const parallax = {
    ...upstream,
    target: background,
    starBatch: new Batch(),
    nebulaContainer: new Display(),
    initialized: false,
    starTxt: {},
    nebulaTxt: {},
    NEBULAS: 8,
    NEBULA_UPDATE_INTERVAL: 200,
    stars: [],
    miniStars: [],
    miniDusts: [],
    nebulas: [],
    g: {},
    resize() {},
    update() {},
  };
  parallax.refresh();
  let settings: DeviceSettings;
  const plugin = {
    id: 'test.background',
    apiVersion: 1,
    activate(api: any) {
      settings = new DeviceSettings(api.storage);
      api.onGame((game: any, session: any) => installBackgroundLayers(game, session, settings));
    },
  };
  const errors: unknown[] = [];
  const host = new PluginHost({
    storage: { getItem: () => null, setItem() {} },
    importer: async () => ({ default: plugin }),
    log: { info() {}, error: (...args: any[]) => errors.push(args) },
  });
  t.after(() => host.dispose());
  await host.load('https://example.com/background.js');
  host.classesReady(definitions);
  const game: any = new Game();
  game.canvasBackground = background;
  game.parallaxManager = parallax;
  game.canvas.addChildAt(background, 0);
  game.layersInfo = [{ name: 'canvasBackground', instance: background, ratio: 1 }];
  host.created(game);
  game.runGameLoop();
  const stars = game.canvasStars;
  assert.equal(parallax.starBatch.get_parent(), stars);
  assert.equal(background.get_alpha(), 0.3);
  assert.equal(stars.get_alpha(), 0.3);
  settings!.set('starBrightness', 0.8);
  assert.equal(stars.get_alpha(), 0.8);
  assert.equal(background.get_alpha(), 0.3);
  for (let i = 0; i < 2; i++) {
    parallax.refresh();
    assert.equal(parallax.starBatch.disposed, false);
    assert.equal(parallax.nebulaContainer.disposed, false);
    assert.equal(parallax.starBatch.get_parent(), stars);
    assert.equal(parallax.stars.length, 40);
  }
  background.set_visible(false);
  assert.equal(stars.get_visible(), false);
  game.exit();
  assert.equal(stars.disposed, true);
  assert.equal(parallax.starBatch.get_parent(), background);
  assert.equal(parallax.starBatch.disposed, false);
  assert.equal(background.get_alpha(), 1);
  assert.equal(game.layersInfo.length, 1);
  assert.equal(game.canvasStars, undefined);
  assert.deepEqual(errors, []);
});
