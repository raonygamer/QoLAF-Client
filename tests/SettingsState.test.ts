import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsState } from '../src/ported/SettingsState';
import { aliasProperties } from '../src/runtime/HaxeInterop';
import { Display } from './fixtures/NativeGame';

test('source Settings window switches all available categories, saves, and disposes pages', (t) => {
  const cleanups: Function[] = [];
  aliasProperties({ defer: (fn: Function) => cleanups.push(fn) } as any, Display);
  t.after(() => cleanups.reverse().forEach((fn) => fn()));
  let saves = 0;
  let reverts = 0;
  const scene = {
    settings: { rotationSpeed: 1.25, save: () => saves++ },
    clientSettings: { settingsCategory: 'graphics', save: () => saves++ },
  };
  const game: any = { stage: { stageWidth: 1400, stageHeight: 900 }, hud: { show: true }, me: {} };
  class PlayState extends Display {
    container = new Display();
    sm = { revertState: () => reverts++ };
    loaded = false;
    constructor(public g: any) {
      super();
    }
    enter() {
      (this as any).resize();
    }
    drawBlackBackground() {}
    clearBackground() {}
    loadCompleted() {
      this.loaded = true;
    }
    exit(done: Function) {
      done();
    }
  }
  class Label extends Display {
    text = '';
  }
  class Button extends Display {
    constructor(
      public click: Function,
      public text: string,
    ) {
      super();
    }
  }
  class Page extends Display {
    constructor(
      _game: any,
      public category = '',
    ) {
      super();
    }
  }
  const definitions: any = {
    'core.states.gameStates.PlayState': PlayState,
    'core.states.gameStates.SettingsChat': Page,
    'core.states.gameStates.SettingsBindings': Page,
    'core.states.gameStates.SettingsGeneral': Page,
    'qolaf.states.SettingsQoLAF': Page,
    'core.hud.components.Button': Button,
    'core.hud.components.SettingsWindowChrome': Display,
    'core.hud.components.Text': Label,
    'core.scene.SceneBase': scene,
    'starling.display.Sprite': Display,
    'starling.display.Quad': Display,
    'generics.Localize': { t: (value: string) => value },
  };
  const State = createSettingsState((name) => definitions[name] ?? {});
  const nativeContainer = new Display();
  const nativeChildren = Object.fromEntries(
    [
      'activePage',
      'bg',
      'generalButton',
      'bindingsButton',
      'chatButton',
      'closeButton',
      'exitButton',
    ].map((key) => {
      const child = new Display();
      nativeContainer.addChild(child);
      return [key, child];
    }),
  );
  const native = { ...nativeChildren };
  State.initializeNative(native);
  assert.equal(
    nativeContainer.get_numChildren(),
    0,
    'hot-enable removes all vanilla page and tab nodes',
  );
  assert.ok(Object.values(nativeChildren).every((child) => child.disposed));
  const state = new State(game);
  state.enter();
  assert.equal(state.activeCategory, 'graphics', 'resume the saved category');
  assert.equal(state.panel.x, 235);
  assert.equal(state.panel.y, 160);
  assert.equal(game.hud.show, false);
  assert.deepEqual(
    state.categories.map((entry: any) => entry.id),
    ['general', 'graphics', 'cosmetics', 'hud', 'combat', 'chat', 'bindings', 'aim'],
  );
  for (const category of state.categories) {
    const previous = state.activePage;
    const changed = state.activeCategory !== category.id;
    category.button.click();
    assert.equal(state.activeCategory, category.id);
    assert.equal(scene.clientSettings.settingsCategory, category.id);
    if (changed) assert.equal(previous.disposed, true);
  }
  const pluginPage = new Page(game, 'plugins');
  state.addExternalCategory('plugins', 'Plugins', () => pluginPage);
  state.addExternalCategory('plugins', 'Plugins', () => pluginPage);
  assert.equal(
    state.categories.filter((entry: { id: string }) => entry.id === 'plugins').length,
    1,
  );
  state.showCategory('plugins');
  assert.equal(state.activePage, pluginPage);
  assert.equal(state.pageTitle.text, 'Plugins');
  assert.equal(pluginPage.x, 170);
  assert.equal(pluginPage.y, 8);
  const page = state.activePage;
  state.close();
  state.close();
  assert.equal(page.disposed, true);
  assert.equal(saves, 2);
  assert.equal(reverts, 1, 'close is idempotent');
  assert.equal(game.me.rotationSpeedMod, 1.25);
  let exited = false;
  state.exit(() => {
    exited = true;
  });
  assert.equal(exited, true);
  assert.equal(state.panel, null);
  assert.equal(state.categories.length, 0);
});
