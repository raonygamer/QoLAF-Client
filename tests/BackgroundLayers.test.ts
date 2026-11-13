import { installParallaxCleanup } from '../src/rendering/ParallaxCleanup';
import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
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

for (const duringIntro of [false, true])
  test(`separate stars survive native refresh and restore ownership (already in intro: ${duringIntro})`, async (t) => {
    class Image extends Display {
      set_pivotX(_value: number) {}
      set_pivotY(_value: number) {}
    }
    class Batch extends Display {
      clear() {}
    }
    const definitions = registry();
    class Intro {
      constructor(public g: object) {}
      enter() {}
      enterRoaming() {}
      exit() {}
    }
    definitions['core.states.gameStates.IntroState'] = Intro;
    const nativeSettings = { get_showBackground: () => true, save() {} };
    definitions['core.scene.SceneBase'].settings = nativeSettings;
    const upstream = methods(
      Image,
      { settings: nativeSettings },
      { write() {} },
      { delayedCall() {} },
    );
    const background = new Display();
    class Parallax {}
    Object.assign(Parallax.prototype, upstream);
    definitions['core.parallax.ParallaxManager'] = Parallax;
    const parallax = Object.assign(new Parallax(), {
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
    });
    delete (parallax as Partial<typeof upstream>).clear;
    parallax.refresh();
    let settings: DeviceSettings;
    const plugin = {
      id: 'test.background',
      apiVersion: 1,
      activate(api: any) {
        api.on('classesReady', () => installParallaxCleanup(api));
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
    bindGameClasses({ cls: (name: string) => definitions[name] ?? {} } as unknown as API);
    host.classesReady(definitions);
    const game: any = new Game();
    game.canvasBackground = background;
    game.parallaxManager = parallax;
    game.canvas.addChildAt(background, 0);
    game.layersInfo = [{ name: 'canvasBackground', instance: background, ratio: 1 }];
    const runningIntro = new Intro(game);
    if (duringIntro) {
      game.gameStateMachine = { currentState: runningIntro };
      background.set_alpha(0.25);
    }
    host.created(game);
    game.runGameLoop();
    const stars = game.canvasStars;
    assert.equal(parallax.starBatch.get_parent(), stars);
    if (duringIntro) {
      assert.equal(background.get_alpha(), 0.25);
      assert.equal(stars.get_alpha(), 0.075);
      runningIntro.enterRoaming();
      background.set_alpha(0.3);
    }
    assert.equal(background.get_alpha(), 0.3);
    assert.equal(stars.get_alpha(), 0.3);
    settings!.set('starBrightness', 0.8);
    assert.equal(stars.get_alpha(), 0.8);
    assert.equal(background.get_alpha(), 0.3);
    const intro = new Intro(game);
    intro.enter();
    assert.equal(stars.get_alpha(), 0, 'stars wait for the native voice preload');
    background.set_alpha(0.25);
    assert.equal(stars.get_alpha(), 0.2);
    settings!.set('starBrightness', 0.6);
    assert.equal(stars.get_alpha(), 0.15, 'brightness edits preserve fade progress');
    assert.equal(background.get_alpha(), 0.25);
    new Intro({}).enter();
    background.set_alpha(0.5);
    assert.equal(stars.get_alpha(), 0.3, 'another scene cannot steal intro ownership');
    intro.enterRoaming();
    assert.equal(stars.get_alpha(), 0.6, 'skip/normal completion restores brightness');
    background.set_alpha(0);
    assert.equal(stars.get_alpha(), 0.6, 'later background effects do not fade stars');
    intro.enter();
    intro.exit();
    assert.equal(stars.get_alpha(), 0.6, 'early exit restores stars');
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
    assert.equal(background.get_alpha(), duringIntro ? 0.25 : 1);
    assert.equal(game.layersInfo.length, 1);
    assert.equal(game.canvasStars, undefined);
    assert.deepEqual(errors, []);
  });
