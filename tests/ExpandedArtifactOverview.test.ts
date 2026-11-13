import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installExpandedArtifactOverview } from '../src/artifacts/ExpandedArtifactOverview';
import { configureArtifactLayout } from '../src/artifacts/ArtifactLayout';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text, Format, Quad } from './fixtures/NativeGame';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('expanded native controls use source chrome, wrapping sort rows, guide and mode actions', (t) => {
  const bitmap = bitmapRendererFixture('verdana24_bitmap');
  t.after(bitmap.cleanup);
  const cleanup: Function[] = [];
  t.after(() => cleanup.reverse().forEach((fn) => fn()));
  const hooks = new Hooks((error: Error) => {
    throw error;
  });
  class Label extends Text {
    constructor(x = 0, y = 0, text = '', size = 12) {
      super(110, 20, text, new Format('test', size, 0xffffff));
      this.set_x(x);
      this.set_y(y);
    }
    set_size(size: number) {
      this.get_format().set_size(size);
    }
  }
  class Button extends bitmap.Sprite {
    text: string;
    autoEnableAfterClick = false;
    constructor(
      public action: () => void,
      text: string,
      ..._args: any[]
    ) {
      super();
      this.text = text;
      this.set_width(text.length * 7 + 10);
      this.set_height(24);
    }
  }
  class Overview extends bitmap.Sprite {
    expandedView = true;
    p = {
      isLanded: false,
      get_level: () => 120,
      artifactCount: 0,
      get_artifactLimit: () => 250,
      artifacts: [],
    };
    g = {};
    activeSlots: any[] = [];
    artifactSetupRowY = 84;
    artifactSetupRowHeight = 24;
    orders: string[] = [];
    [key: string]: any;
    load() {
      this.loadingText = new Text(400, 100, 'Loading data...');
      this.addChild(this.loadingText);
    }
    loadComplate() {
      this.drawComponents();
    }
    initActiveSlots() {
      const slot = new Quad(40, 40);
      this.activeSlots.push(slot);
      this.addChild(slot);
    }
    drawArtifactsInCargo() {
      this.cargoAtCreation = [this.cargoY, this.cargoHeight];
    }
    drawComponents() {
      this.initActiveSlots();
      const line = new Quad(650, 1, 0xaaaaaa);
      this.addChildAt(line, 0);
      this.drawArtifactsInCargo();
      this.statsContainer = new bitmap.Sprite();
      this.addChild(this.statsContainer);
      this.statsContainer.addChild(new Label());
      this.statisticSummary = new Text(250, 560, '');
      this.statsContainer.addChild(this.statisticSummary);
      this.crewContainer = new bitmap.Sprite();
      this.addChild(this.crewContainer);
      for (const name of [
        'toggleRecycleButton',
        'toggleUpgradeButton',
        'cancelUpgradeButton',
        'upgradeButton',
        'chooseSortingButton',
        'cancelRecycleButton',
        'recycleButton',
        'selectAllRecycleButton',
      ]) {
        this[name] = new Button(() => {}, name);
        this.addChild(this[name]);
      }
    }
    recycleMode = false;
    upgradeMode = false;
    toggleRecycle() {
      this.recycleMode = !this.recycleMode;
      this.chooseSortingButton.set_visible(!this.chooseSortingButton.get_visible());
    }
    toggleUpgrade() {
      this.upgradeMode = !this.upgradeMode;
      this.chooseSortingButton.set_visible(!this.chooseSortingButton.get_visible());
    }
    onBuyArtifactConfirm() {
      this.p.artifactCount = 5;
    }
    reloadStats() {}
    onRecycleMessage() {}
    onSort(order: string) {
      this.orders.push(order);
    }
    chooseSorting() {
      this.orders.push('popup');
    }
  }
  const settings = { expandedArtifactOverview: true };
  const classes: any = {
    'core.artifact.ArtifactOverview': Overview,
    'core.hud.components.Button': Button,
    'core.hud.components.TextBitmap': Label,
    'generics.Localize': { t: (value: string) => value },
    'core.scene.SceneBase': { clientSettings: settings },
    'starling.text.TextField': Text,
    'starling.text.TextFormat': Format,
  };
  const resolve = (name: string): any => classes[name] ?? bitmap.resolve(name);
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
  };
  for (const type of ['before', 'after', 'around'])
    api[type] = (target: any, key: string, fn: Function) => hooks.add(target, key, type, fn);
  installExpandedArtifactOverview(api, resolve);
  const view = new Overview();
  configureArtifactLayout(view, 1200, 800);
  view.load();
  assert.equal(view.expandedChrome.getChildAt(0).get_width(), 1200);
  assert.equal(view.loadingPanel.get_x(), 240);
  assert.equal(view.loadingPanel.get_y(), 310);
  assert.equal(view.loadingText.get_text(), 'Loading artifacts...');
  const loading = view.loadingPanel;
  view.loadComplate();
  assert.equal(loading.disposed, true);
  assert.equal(view.statsContainer.get_x(), view.statsX);
  assert.equal(view.statsContainer.get_height(), view.statsHeight);
  assert.equal(view.chooseSortingButton.get_visible(), false);
  assert.equal(view.toggleRecycleButton.get_y(), 760);
  assert.equal(view.activeSlots[0].get_y(), 14);
  assert.equal(view.sortingBar.get_y(), 116);
  assert.ok(view.cargoY > 152, 'narrow cargo wraps source inline sort controls');
  assert.deepEqual(view.cargoAtCreation, [view.cargoY, view.cargoHeight]);
  const strength = view.sortingBar.getChildAt(1);
  strength.action();
  strength.action();
  assert.deepEqual(view.orders, ['levelhigh', 'levellow']);
  const name = view.sortingBar.getChildAt(7);
  name.action();
  name.action();
  assert.deepEqual(view.orders.slice(-2), ['nameasc', 'namedesc']);
  assert.equal(strength.autoEnableAfterClick, true);
  assert.match(view.inventorySummary.text, /Artifact inventory/);
  assert.match(view.fitnessGuide.text, /Adequacy/);
  for (const action of ['toggleRecycle', 'toggleUpgrade']) {
    view[action]();
    assert.equal(
      view.chooseSortingButton.get_visible(),
      false,
      'expanded mode never exposes classic Sorting',
    );
    for (const node of [view.sortingBar, view.inventorySummary, view.fitnessGuide])
      assert.equal(node.get_visible(), false);
    view[action]();
    assert.equal(view.chooseSortingButton.get_visible(), false);
    for (const node of [view.sortingBar, view.inventorySummary, view.fitnessGuide])
      assert.equal(node.get_visible(), true);
  }
  view.onBuyArtifactConfirm();
  assert.match(view.inventorySummary.text, /Stored: 5 \/ 250/);
  view.p.artifactCount = 3;
  view.updateInventorySummary();
  assert.match(view.inventorySummary.text, /Stored: 3 \/ 250/);

  let changes = 0,
    closes = 0;
  view.addEventListener('artifactOverviewLayoutChanged', () => changes++);
  view.addEventListener('artifactOverviewCloseRequested', () => closes++);
  view.layoutToggleButton.action();
  view.closeViewButton.action();
  assert.equal(settings.expandedArtifactOverview, false);
  assert.equal(changes, 1);
  assert.equal(closes, 1);
  view.dispose();
  view.loadComplate();
  view.drawComponents();
  assert.equal(view.get_numChildren(), 0, 'late loading callbacks cannot rebuild a disposed view');
});
