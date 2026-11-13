import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expandedArtifactsOpen, installArtifactMenu } from '../src/artifacts/ArtifactMenu';
import { bindGameClasses } from '../src/game/Bindings';
import { configureArtifactLayout, artifactInventorySummary } from '../src/artifacts/ArtifactLayout';
import { Display, Quad } from './fixtures/NativeGame';
// @ts-expect-error production dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('expanded overview uses source dimensions, cargo columns, and inventory summary', () => {
  const view = { expandedView: true };
  configureArtifactLayout(view, 1920, 1080);
  assert.equal(view.viewWidth, 1920);
  assert.equal(view.statsWidth, 340);
  assert.equal(view.cargoWidth, 1262);
  assert.equal(view.cargoColumns, 34);
  assert.equal(view.infoX, 1656);
  assert.equal(view.actionY, 1040);
  configureArtifactLayout(view, 800, 500);
  assert.equal(view.viewWidth, 900);
  assert.equal(view.viewHeight, 600);
  assert.equal(view.cargoColumns, 7);
  view.expandedView = false;
  configureArtifactLayout(view, 1920, 1080);
  assert.equal(view.viewWidth, 665);
  assert.equal(view.cargoColumns, 10);
  assert.equal(view.cargoY, 105);
  assert.match(
    artifactInventorySummary({
      get_level: () => 120,
      artifactCount: 0,
      get_artifactLimit: () => 250,
      artifacts: [],
    }),
    /Optimal artifact level: 150 \(Max\)<br>Average fitness: 0.0<br>Highest fitness: 0.0$/,
  );
});

test('native artifact menu toggles layouts, handles landed rules, restores chrome and closes through native MenuHud.close', () => {
  const hooks = new Hooks((error: Error) => {
    throw error;
  });
  const cleanups: Function[] = [];
  const stage: any = new Display();
  stage.get_stageWidth = () => 1200;
  stage.get_stageHeight = () => 800;
  const stats = {
    showStats: true,
    get_showStats() {
      return this.showStats;
    },
    set_showStats(value: boolean) {
      return (this.showStats = value);
    },
  };
  const settings = { expandedArtifactOverview: true };
  const disposedTooltipTypes: string[] = [];
  const outer: any = new Display();
  outer.localToGlobal = () => ({ x: 220, y: 90 });
  const dim = new Quad(1200, 800);
  dim.set_alpha(0.7);
  outer.addChild(dim);
  class Menu extends Display {}
  const menu: any = new Menu();
  menu.get_stage = () => stage;
  menu.bgr = new Display();
  menu.continueGameButton = new Display();
  outer.addChild(menu);
  const player = { isLanded: false };
  let chatActive = true;
  let chatCloses = 0;
  const game: any = {
    me: player,
    messageLog: new Display(),
    chatInput: {
      isActive: () => chatActive,
      closeChat() {
        chatActive = false;
        chatCloses++;
      },
    },
  };
  class Base {
    g = game;
    sm = { parent: menu };
    container: Display | null = null;
    enter() {
      this.container = new Display();
      menu.addChild(this.container);
    }
    exit() {
      this.container?.removeFromParent(true);
      this.container = null;
    }
    addChild(child: Display) {
      this.container!.addChild(child);
    }
    removeChild(child: Display, dispose: boolean) {
      this.container!.removeChild(child, dispose);
    }
  }
  class State extends Base {
    enter() {
      assert.fail('native classic-only enter must be replaced');
    }
  }
  class Overview extends Display {
    p = player;
    [key: string]: any;
    load() {
      this.loaded = true;
    }
  }
  const classes: any = {
    'core.scene.Game': class {},
    'core.hud.MenuHud': Menu,
    'core.states.menuStates.ArtifactState2': State,
    'core.states.DisplayState': Base,
    'core.artifact.ArtifactOverview': Overview,
    'starling.display.Quad': Quad,
    'starling.core.Starling': { get_current: () => ({ get_stage: () => stage }) },
    'openfl.geom.Point': class {
      constructor(
        public x: number,
        public y: number,
      ) {}
    },
    RymdenRunt: { s: stats },
    'core.scene.SceneBase': { clientSettings: settings },
    'core.hud.components.ToolTip': {
      disposeType(type: string) {
        disposedTooltipTypes.push(type);
      },
    },
  };
  const api: any = {
    cls: (name: string) => classes[name] ?? {},
    defer: (fn: Function) => cleanups.push(fn),
  };
  for (const type of ['around', 'before'])
    api[type] = (target: any, key: string, fn: Function) => hooks.add(target, key, type, fn);
  bindGameClasses(api);
  installArtifactMenu(api);
  const state = new State();
  menu.close = () => state.exit();
  state.enter();
  let view = state.container!.getChildAt(0) as Overview;
  assert.equal(view.expandedView, true);
  assert.equal(expandedArtifactsOpen(game), true);
  assert.equal(game.messageLog.get_visible(), false);
  assert.equal(chatCloses, 1);
  assert.equal(view.loaded, true);
  assert.equal(view.get_x(), 0);
  assert.equal(menu.get_x(), -220);
  assert.equal(menu.get_y(), -90);
  assert.equal(menu.bgr.get_visible(), false);
  assert.equal(stats.showStats, false);
  assert.equal(dim.get_alpha(), 0.35);
  settings.expandedArtifactOverview = false;
  chatActive = true;
  view.dispatchEventWith('artifactOverviewLayoutChanged');
  assert.equal(view.disposed, true);
  view = state.container!.getChildAt(0) as Overview;
  assert.equal(view.expandedView, false);
  assert.equal(expandedArtifactsOpen(game), false);
  assert.equal(game.messageLog.get_visible(), true);
  assert.equal(chatActive, true);
  assert.equal(chatCloses, 1);
  assert.equal(view.get_x(), 55);
  assert.equal(view.get_y(), 50);
  assert.equal(menu.get_x(), 0);
  assert.equal(menu.bgr.get_visible(), true);
  assert.equal(dim.get_alpha(), 0.7);
  assert.equal(stats.showStats, true);
  settings.expandedArtifactOverview = true;
  player.isLanded = true;
  view.dispatchEventWith('artifactOverviewLayoutChanged');
  view = state.container!.getChildAt(0) as Overview;
  assert.equal(view.landedClassicView, true);
  assert.equal(view.expandedView, false);
  assert.equal(expandedArtifactsOpen(game), false);
  assert.equal(game.messageLog.get_visible(), true);
  assert.equal(chatActive, true);
  assert.equal(
    settings.expandedArtifactOverview,
    true,
    'landed classic presentation preserves preference',
  );
  player.isLanded = false;
  view.dispatchEventWith('artifactOverviewLayoutChanged');
  view = state.container!.getChildAt(0) as Overview;
  assert.equal(expandedArtifactsOpen(game), true);
  assert.equal(game.messageLog.get_visible(), false);
  assert.equal(chatActive, false);
  assert.equal(chatCloses, 2, 'switching back to expanded closes active chat');
  disposedTooltipTypes.length = 0;
  view.dispatchEventWith('artifactOverviewCloseRequested');
  assert.deepEqual(
    disposedTooltipTypes,
    ['artifactBox'],
    'closing clears hovered artifact tooltips',
  );
  assert.equal(state.container, null);
  assert.equal(expandedArtifactsOpen(game), false);
  assert.equal(stage.listeners('resize').length, 0);
  assert.equal(menu.listeners('addedToStage').length, 0);
  assert.equal(game.messageLog.get_visible(), true);
  // Whole-screen navigation can remove MenuHud without calling its close/unload.
  state.enter();
  assert.equal(expandedArtifactsOpen(game), true);
  menu.dispatchEventWith('removedFromStage');
  assert.equal(expandedArtifactsOpen(game), false);
  assert.equal(game.messageLog.get_visible(), true);
  assert.equal(stage.listeners('resize').length, 0);
  assert.equal(menu.listeners('removedFromStage').length, 0);
  menu.close = () => assert.fail('unload must not navigate through a removed menu');
  for (const off of cleanups) off();
});
