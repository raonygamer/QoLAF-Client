import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installArtifactMenu } from '../src/artifacts/ArtifactMenu';
import { configureArtifactLayout, artifactInventorySummary } from '../src/artifacts/ArtifactLayout';
import { Display, Quad } from './fixtures/NativeGame';
// @ts-expect-error production dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('expanded overview uses source dimensions, cargo columns, and inventory summary', () => {
  const view: any = { expandedView: true };
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
      level: 120,
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
  const stats = { showStats: true };
  const settings = { expandedArtifactOverview: true };
  const outer: any = new Display();
  outer.localToGlobal = () => ({ x: 220, y: 90 });
  const dim = new Quad(1200, 800);
  dim.set_alpha(0.7);
  outer.addChild(dim);
  const menu: any = new Display();
  menu.get_stage = () => stage;
  menu.bgr = new Display();
  menu.continueGameButton = new Display();
  outer.addChild(menu);
  const player = { isLanded: false };
  const game: any = { me: player, messageLog: new Display(), chatInput: { isActive: () => false } };
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
    'core.hud.components.ToolTip': { disposeType() {} },
  };
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanups.push(fn),
  };
  for (const type of ['around', 'before'])
    api[type] = (target: any, key: string, fn: Function) => hooks.add(target, key, type, fn);
  installArtifactMenu(api);
  const state = new State();
  menu.close = () => state.exit();
  state.enter();
  let view = state.container!.getChildAt(0) as Overview;
  assert.equal(view.expandedView, true);
  assert.equal(view.loaded, true);
  assert.equal(view.get_x(), 0);
  assert.equal(menu.get_x(), -220);
  assert.equal(menu.get_y(), -90);
  assert.equal(menu.bgr.get_visible(), false);
  assert.equal(stats.showStats, false);
  assert.equal(dim.get_alpha(), 0.35);
  settings.expandedArtifactOverview = false;
  view.dispatchEventWith('artifactOverviewLayoutChanged');
  assert.equal(view.disposed, true);
  view = state.container!.getChildAt(0) as Overview;
  assert.equal(view.expandedView, false);
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
  assert.equal(
    settings.expandedArtifactOverview,
    true,
    'landed classic presentation preserves preference',
  );
  view.dispatchEventWith('artifactOverviewCloseRequested');
  assert.equal(state.container, null);
  assert.equal(stage.listeners('resize').length, 0);
  assert.equal(menu.listeners('addedToStage').length, 0);
  assert.equal(game.messageLog.get_visible(), true);
  for (const off of cleanups) off();
});
