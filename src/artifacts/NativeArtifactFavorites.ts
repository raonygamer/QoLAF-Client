import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { ArtifactFavorites } from './ArtifactFavorites';
import { createArtifactContextPopup } from './ArtifactContextPopup';
import { installArtifactRecycleProtection } from './ArtifactRecycleProtection';

/** Source favorite marker and overview right-click menu, with browser pointer transport. */
export function installNativeArtifactFavorites(api: API, resolve: Resolve): void {
  const favorites = new ArtifactFavorites(api.storage);
  installArtifactRecycleProtection(api, favorites);
  const Overview = api.cls('core.artifact.ArtifactOverview')!.prototype;
  const Sprite = resolve('starling.display.Sprite');
  const Quad = resolve('starling.display.Quad');
  const Point = resolve('openfl.geom.Point');
  const Popup = createArtifactContextPopup(resolve);
  const overlays = api.cls('core.hud.components.ui.DomOverlay');
  const markers = new Map<Raw, Raw>();
  const views = new Map<Raw, Raw>();
  const refresh = (box: Raw) => {
    const favorite = !!box.a && favorites.isFavorite(box.p.id, box.a.id);
    if (favorite && read(box.frame, 'color') === 12203572) box.setNotSelected?.();
    let marker = markers.get(box);
    if (favorite && !marker && box.frame) {
      marker = new Sprite();
      marker!.touchable = false;
      const width = Math.max(1, read(box.frame, 'width') - 6);
      const height = Math.max(1, read(box.frame, 'height') - 6);
      for (const [x, y, w, h] of [
        [3, 3, width, 1],
        [3, 3 + height - 1, width, 1],
        [3, 3, 1, height],
        [3 + width - 1, 3, 1, height],
      ]) {
        const edge = new Quad(w, h, 0xffcc55);
        edge.x = x;
        edge.y = y;
        marker!.addChild(edge);
      }
      markers.set(box, marker!);
    }
    if (marker) {
      marker.visible = favorite;
      box.addChild(marker);
    }
  };
  for (const name of ['core.artifact.ArtifactCargoBox', 'core.artifact.ArtifactBox']) {
    const Box = api.cls(name)?.prototype;
    if (!Box) continue;
    api.after(Box, 'update', function () {
      refresh(this);
    });
    api.before(Box, 'dispose', function () {
      markers.delete(this);
    });
  }
  api.after(Overview, 'drawComponents', function () {
    if (views.has(this)) return;
    const view = this;
    const popup = new Popup();
    view.addChild(popup);
    views.set(view, popup);
    popup.addEventListener('artifactShareContextFavorite', (event: Raw) => {
      const artifact = read(event, 'data');
      if (!artifact || view.p.getArtifactById(artifact.id) !== artifact) return;
      if (view.artifactRecyclePending) {
        view.g.showMessageDialog('Wait for recycling to finish before changing favorites.');
        return;
      }
      favorites.setFavorite(view.p.id, artifact.id, !favorites.isFavorite(view.p.id, artifact.id));
      for (let i = view.markedForRecycle.length - 1; i >= 0; i--) {
        const selected = view.markedForRecycle[i];
        if (!selected || favorites.isFavorite(view.p.id, selected.id))
          view.markedForRecycle.splice(i, 1);
      }
      for (const box of [...view.cargoBoxes, ...view.activeSlots]) refresh(box);
    });
    popup.addEventListener('artifactShareContextShare', (event: Raw) => {
      const artifact = read(event, 'data');
      const game = view.g;
      const menu = read(view, 'parent')?.sm?.parent;
      if (!artifact?.revealed || !menu?.closeMenu || !game.chatInput?.insertArtifactLink) return;
      api.cls('core.hud.components.ToolTip')?.disposeType('artifactBox');
      menu.closeMenu();
      queueMicrotask(() => {
        if (!read(game, 'isLeaving') && game.me && game.chatInput)
          game.chatInput.insertArtifactLink(game.me.id, artifact);
      });
    });
  });
  api.before(Overview, 'dispose', function () {
    views.get(this)?.removeFromParent(true);
    views.delete(this);
  });
  const onContext = (event: MouseEvent) => {
    const css = overlays?.toCss({ x: 0, y: 0, width: 1, height: 1 });
    if (!css || !(css.width > 0 && css.height > 0)) return;
    const point = new Point(
      (event.clientX - css.x) / css.width,
      (event.clientY - css.y) / css.height,
    );
    for (const [view, popup] of views) {
      const stage = read(view, 'stage');
      let visible = !!stage;
      for (let node: Raw | null = view; node; node = read(node, 'parent'))
        if (!read(node, 'visible') || read(node, 'alpha') <= 0) visible = false;
      if (!visible) {
        popup.close();
        continue;
      }
      if (popup.containsStagePoint(point)) {
        event.preventDefault();
        return;
      }
      let artifact: Raw | null = null;
      for (let node = stage.hitTest(point); node && node !== view; node = read(node, 'parent'))
        if (view.cargoBoxes.includes(node) || view.activeSlots.includes(node)) {
          artifact = node.a;
          break;
        }
      if (!artifact) {
        popup.close();
        continue;
      }
      event.preventDefault();
      event.stopPropagation();
      for (const tip of [...(api.cls('core.hud.components.ToolTip')?.shown ?? [])])
        if (tip.type === 'artifactBox') tip.hide();
      const local = view.globalToLocal(point);
      popup.showFor(
        artifact,
        local.x,
        local.y,
        view.viewWidth ?? 665,
        view.viewHeight ?? 520,
        favorites.isFavorite(view.p.id, artifact.id),
      );
      view.setChildIndex(popup, read(view, 'numChildren') - 1);
      return;
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('contextmenu', onContext, true);
  api.defer(() => {
    if (typeof document !== 'undefined')
      document.removeEventListener('contextmenu', onContext, true);
    for (const popup of views.values()) popup.removeFromParent(true);
    views.clear();
    for (const marker of markers.values()) marker.removeFromParent(true);
    markers.clear();
  });
}
