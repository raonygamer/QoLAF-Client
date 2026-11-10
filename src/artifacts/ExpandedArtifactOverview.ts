import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { artifactFitnessGuide, artifactInventorySummary } from './ArtifactLayout';

/** Source expanded overview presentation, built from the native artifact controls. */
export function installExpandedArtifactOverview(api: API, resolve: Resolve): void {
  const Overview = api.cls('core.artifact.ArtifactOverview')!.prototype;
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const Button = resolve('core.hud.components.Button');
  const Text = resolve('core.hud.components.TextBitmap');
  const Localize = resolve('generics.Localize');
  let Renderer: any, BitmapFormat: any;
  const dead = new WeakSet<Raw>();
  const views = new Set<Raw>();
  const border = (
    target: Raw,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    thickness: number,
    alpha: number,
  ) => {
    for (const [left, top, w, h] of [
      [x, y, width, thickness],
      [x, y + height - thickness, width, thickness],
      [x, y, thickness, height],
      [x + width - thickness, y, thickness, height],
    ]) {
      const quad = new Quad(w, h, color);
      quad.x = left;
      quad.y = top;
      quad.alpha = alpha;
      target.addChild(quad);
    }
  };
  const chrome = (view: Raw) => {
    view.expandedChrome?.removeFromParent(true);
    const root = (view.expandedChrome = new Sprite());
    view.addChildAt(root, 0);
    const background = new Quad(view.viewWidth, view.viewHeight, 0);
    background.alpha = 0.74;
    root.addChild(background);
    border(root, 1, 1, view.viewWidth - 2, view.viewHeight - 2, 0x707070, 2, 0.95);
    border(root, 5, 5, view.viewWidth - 10, view.viewHeight - 10, 0x282828, 1, 0.8);
    for (const [x, width] of [
      [view.statsX, view.statsWidth],
      [view.infoX, view.infoWidth],
    ]) {
      const panel = new Quad(width + 16, view.statsHeight + 16, 0x080808);
      panel.x = x - 8;
      panel.y = view.statsY - 8;
      panel.alpha = 0.76;
      root.addChild(panel);
      border(root, panel.x, panel.y, panel.width, panel.height, 0x505050, 1, 0.8);
    }
    border(
      root,
      view.cargoX - 8,
      view.cargoY - 8,
      view.cargoWidth + 16,
      view.cargoHeight + 16,
      0x505050,
      1,
      0.65,
    );
  };
  const close = (view: Raw) => view.dispatchEventWith('artifactOverviewCloseRequested');
  const controls = (view: Raw, loading = false) => {
    if (view.landedClassicView) return;
    if (view.expandedView && !view.closeViewButton) {
      view.closeViewButton = new Button(
        () => close(view),
        Localize.t('Close'),
        'highlight',
        12,
        'Verdana',
      );
      view.addChild(view.closeViewButton);
      view.closeViewButton.x = view.viewWidth - view.closeViewButton.width - 14;
      view.closeViewButton.y = 14;
    }
    if (loading) return;
    if (!view.layoutToggleButton) {
      view.layoutToggleButton = new Button(
        () => {
          if (view.p.isLanded) return;
          const settings = api.cls('core.scene.SceneBase')!.clientSettings;
          settings.expandedArtifactOverview = !view.expandedView;
          view.dispatchEventWith('artifactOverviewLayoutChanged');
        },
        Localize.t(view.expandedView ? 'Classic view' : 'Expanded view'),
        'highlight',
        12,
        'Verdana',
      );
      view.addChild(view.layoutToggleButton);
    }
    view.layoutToggleButton.x = view.expandedView
      ? view.closeViewButton.x - view.layoutToggleButton.width - 10
      : view.viewWidth - view.layoutToggleButton.width - 150;
    view.layoutToggleButton.y = view.expandedView ? 14 : 0;
    for (const button of [view.closeViewButton, view.layoutToggleButton])
      if (button) view.setChildIndex(button, read(view, 'numChildren') - 1);
  };
  const inlineSorting = (view: Raw) => {
    if (view.sortingBar) return;
    const bar = (view.sortingBar = new Sprite());
    bar.x = view.cargoX;
    bar.y = view.artifactSetupRowY + view.artifactSetupRowHeight + 8;
    view.addChild(bar);
    const label = new Text(0, 6, Localize.t('Sort'), 12);
    label.format.color = 0xaaaaaa;
    bar.addChild(label);
    const buttons: Raw[] = [];
    for (const [key, title] of [
      ['level', 'Strength'],
      ['potential', 'Potential'],
      ['fitness', 'Fitness'],
      ['adequacy', 'Adequacy'],
      ['modifiers', 'Lines'],
      ['upgrades', 'Upgrades'],
      ['name', 'Name'],
    ]) {
      let descending = key !== 'name';
      const text = Localize.t(title);
      const caption = () =>
        text + (key === 'name' ? (descending ? ' Z-A' : ' A-Z') : descending ? ' v' : ' ^');
      const button = new Button(
        () => {
          view.onSort(
            key + (key === 'name' ? (descending ? 'desc' : 'asc') : descending ? 'high' : 'low'),
          );
          button.text = caption();
          descending = !descending;
        },
        caption(),
        'normal',
        11,
        'Verdana',
      );
      button.autoEnableAfterClick = true;
      bar.addChild(button);
      buttons.push(button);
    }
    const stat = new Button(
      () => view.chooseSorting(),
      Localize.t('Stat type...'),
      'normal',
      11,
      'Verdana',
    );
    stat.autoEnableAfterClick = true;
    bar.addChild(stat);
    buttons.push(stat);
    let x = label.width + 10,
      y = 0,
      rowHeight = label.y + label.height,
      firstRow = true;
    for (const button of buttons) {
      if (x + button.width > view.cargoWidth && (firstRow || x > 0)) {
        y += rowHeight + 5;
        x = 0;
        rowHeight = 0;
        firstRow = false;
      }
      button.x = x;
      button.y = y;
      x += button.width + 5;
      rowHeight = Math.max(rowHeight, button.height);
    }
    view.cargoY = Math.max(152, Math.ceil(bar.y + bar.height + 10));
    view.cargoHeight = view.actionY - view.cargoY - 18;
  };
  const information = (view: Raw) => {
    Renderer ??= resolve('core.hud.components.chat.rich.RichBitmapFontTextRenderer');
    BitmapFormat ??= resolve('feathers.text.BitmapFontTextFormat');
    const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
    const make = (height: number, size: number, color: number) => {
      const text = new Renderer();
      Object.assign(text, {
        width: view.infoWidth - 16,
        height,
        textFormat: new BitmapFormat(Verdana.UI_24_FONT_NAME, size, color, 'left'),
        wordWrap: true,
        truncateToFit: false,
        useSeparateBatch: false,
        textureSmoothing: 'bilinear',
        pixelSnapping: false,
        touchable: false,
        x: view.infoX,
      });
      view.addChild(text);
      return text;
    };
    view.inventorySummary = make(120, 12, 0xd3d3d3);
    view.inventorySummary.y = view.statsY;
    view.inventorySummary.text = artifactInventorySummary(view.p);
    view.fitnessGuide = make(265, 11, 0xcccccc);
    view.fitnessGuide.y = view.statsY + 125;
    view.fitnessGuide.text = artifactFitnessGuide;
  };
  const clearLoading = (view: Raw) => {
    if (!view.loadingText && !view.loadingPanel) return;
    if (view.loadingText) api.cls('com.greensock.TweenMax')?.killTweensOf(view.loadingText);
    if (view.loadingPanel) view.loadingPanel.removeFromParent(true);
    else view.loadingText?.removeFromParent(true);
    view.loadingPanel = null;
    view.loadingText = null;
  };
  api.after(Overview, 'load', function () {
    if (dead.has(this)) return;
    if (!this.expandedView) {
      if (this.loadingText) {
        const Format = resolve('starling.text.TextFormat');
        const Russo = resolve('core.text.RussoBitmapFontRegistry');
        this.loadingText.set_format(new Format(Russo.fontNameForSize(30), 30, 0xffffff));
      }
      return;
    }
    chrome(this);
    controls(this, true);
    if (!this.loadingText) return;
    const width = Math.min(720, this.viewWidth - 80);
    const panel = (this.loadingPanel = new Sprite());
    panel.x = Math.round((this.viewWidth - width) / 2);
    panel.y = Math.round((this.viewHeight - 180) / 2);
    const background = new Quad(width, 180, 0x080808);
    background.alpha = 0.88;
    panel.addChild(background);
    border(panel, 0, 0, width, 180, 0x707070, 2, 0.95);
    const Field = resolve('starling.text.TextField');
    const Format = resolve('starling.text.TextFormat');
    const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
    const label = this.loadingText;
    label.set_width(width - 40);
    label.set_height(70);
    label.set_format(new Format(Verdana.fontNameForSize(36), 36, 0xfff1a8, 'center', 'center'));
    label.set_text(Localize.t('Loading artifacts...'));
    label.set_x(20);
    label.set_y(28);
    panel.addChild(label);
    const detail = new Field(
      width - 40,
      40,
      Localize.t('Preparing your artifact inventory'),
      new Format(Verdana.fontNameForSize(16), 16, 0xc6d2dd, 'center', 'center'),
    );
    detail.x = 20;
    detail.y = 105;
    panel.addChild(detail);
    this.addChild(panel);
  });
  api.before(Overview, 'drawComponents', function () {
    clearLoading(this);
  });
  api.after(Overview, 'initActiveSlots', function () {
    if (!this.expandedView) return;
    for (const slot of this.activeSlots) {
      slot.set_x(read(slot, 'x') + 14);
      slot.set_y(14);
    }
  });
  api.before(Overview, 'drawArtifactsInCargo', function () {
    if (!this.expandedView) return;
    inlineSorting(this);
    this.statsY = Math.max(this.statsY, this.artifactSetupRowY + this.artifactSetupRowHeight + 24);
    this.statsHeight = Math.max(1, this.actionY - this.statsY - 18);
  });
  api.around(Overview, 'loadComplate', function (next, ...args) {
    if (!dead.has(this)) return next(...args);
    api.cls('core.artifact.ArtifactOverview')!.artifactsLoaded = true;
  });
  api.around(Overview, 'drawComponents', function (next, ...args) {
    if (dead.has(this)) return;
    return next(...args);
  });
  api.after(Overview, 'drawComponents', function () {
    if (dead.has(this)) return;
    views.add(this);
    if (!this.expandedView) {
      controls(this);
      return;
    }
    const separator = this.getChildAt(0);
    if (read(separator, 'color') === 0xaaaaaa && read(separator, 'height') === 1) {
      this.artifactSetupSeparator = separator;
      separator.set_x(14);
      separator.set_width(this.viewWidth - 28);
      separator.set_y(this.artifactSetupRowY + this.artifactSetupRowHeight + 6);
    }
    for (const node of [this.statsContainer, this.crewContainer]) {
      node.set_x(this.statsX);
      node.set_y(this.statsY);
    }
    this.statsContainer.set_width(this.statsWidth);
    this.statsContainer.set_height(this.statsHeight);
    const label = this.statsContainer.getChildAt(0);
    label.set_size(18);
    this.statisticSummary.set_width(this.statsWidth - 20);
    this.statisticSummary.set_height(Math.max(560, this.statsHeight - 30));
    this.statisticSummary.get_format().set_size(13);
    this.toggleRecycleButton.set_x(this.cargoX);
    this.toggleUpgradeButton.set_x(this.cargoX + read(this.toggleRecycleButton, 'width') + 10);
    for (const button of [this.cancelUpgradeButton, this.cancelRecycleButton])
      button.set_x(this.cargoX + 140);
    this.upgradeButton.set_x(
      read(this.cancelUpgradeButton, 'x') + read(this.cancelUpgradeButton, 'width') + 30,
    );
    this.recycleButton.set_x(
      read(this.cancelRecycleButton, 'x') + read(this.cancelRecycleButton, 'width') + 30,
    );
    this.selectAllRecycleButton.set_x(
      read(this.cancelRecycleButton, 'x') - read(this.selectAllRecycleButton, 'width') - 10,
    );
    for (const name of [
      'toggleRecycleButton',
      'toggleUpgradeButton',
      'cancelUpgradeButton',
      'upgradeButton',
      'chooseSortingButton',
      'cancelRecycleButton',
      'recycleButton',
      'selectAllRecycleButton',
    ])
      this[name].set_y(this.actionY);
    this.chooseSortingButton.set_visible(false);
    this.redrawExpandedChrome = () => chrome(this);
    chrome(this);
    information(this);
    controls(this);
  });
  for (const method of ['reloadStats', 'onRecycleMessage', 'onSort'])
    api.after(Overview, method, function () {
      if (!dead.has(this) && this.inventorySummary)
        this.inventorySummary.text = artifactInventorySummary(this.p);
    });
  api.before(Overview, 'dispose', function () {
    clearLoading(this);
    dead.add(this);
    this.artifactViewDisposed = true;
    views.delete(this);
  });
  api.defer(() => {
    for (const view of views) {
      for (const name of [
        'expandedChrome',
        'inventorySummary',
        'fitnessGuide',
        'sortingBar',
        'layoutToggleButton',
        'closeViewButton',
      ])
        view[name]?.removeFromParent(true);
    }
    views.clear();
  });
}
