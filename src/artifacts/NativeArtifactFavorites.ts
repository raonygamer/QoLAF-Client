import { hideTooltips } from '../ui/NativeTooltip';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  ArtifactBox,
  ArtifactCargoBox,
  ArtifactOverview,
  Sprite,
  Quad,
  Point,
  DomOverlay,
  ToolTip,
  type Artifact,
  type DisplayObject,
} from '../game/Bindings';
import type { Game } from '../game/Game';
import type { ArtifactComposer } from '../chat/NativeArtifactDraft';
import type { ArtifactView } from './ArtifactView';
import { ArtifactFavorites } from './ArtifactFavorites';
import { createArtifactContextPopup } from './ArtifactContextPopup';
import { installArtifactRecycleProtection } from './ArtifactRecycleProtection';

/** Source favorite marker and overview right-click menu, with browser pointer transport. */
export function installNativeArtifactFavorites(api: API): ArtifactFavorites {
  const favorites = new ArtifactFavorites(api.storage);
  installArtifactRecycleProtection(api, favorites);
  const reflection = new GameReflection(api);
  const Overview: ArtifactView = ArtifactOverview.prototype;
  const Popup = createArtifactContextPopup();
  const markers = new Map<ArtifactBox | ArtifactCargoBox, Sprite>();
  const views = new Map<ArtifactView, InstanceType<typeof Popup>>();
  const selectedArtifact = (
    view: ArtifactView,
    event: Game.starling.events.Event,
  ): Artifact | null => {
    const value: unknown = event.data;
    if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string')
      return null;
    const artifact = view.p.getArtifactById(value.id);
    return artifact === value ? artifact : null;
  };
  let alive = true;
  const refresh = (box: ArtifactBox | ArtifactCargoBox) => {
    const favorite =
      !(box instanceof ArtifactBox && box.locked) &&
      !!box.a &&
      favorites.isFavorite(box.p.id, box.a.id);
    if (favorite && box instanceof ArtifactCargoBox && box.frame?.get_color() === 12203572)
      box.setNotSelected();
    let marker = markers.get(box);
    if (favorite && !marker && box.frame) {
      marker = new Sprite();
      marker.set_touchable(false);
      const width = Math.max(1, box.frame.get_width() - 6);
      const height = Math.max(1, box.frame.get_height() - 6);
      for (const [x, y, w, h] of [
        [3, 3, width, 1],
        [3, 3 + height - 1, width, 1],
        [3, 3, 1, height],
        [3 + width - 1, 3, 1, height],
      ]) {
        const edge = new Quad(w, h, 0xffcc55);
        edge.set_x(x);
        edge.set_y(y);
        marker.addChild(edge);
      }
      markers.set(box, marker);
    }
    if (marker) {
      marker.set_visible(favorite);
      box.addChild(marker);
    }
  };
  for (const Box of [ArtifactCargoBox.prototype, ArtifactBox.prototype]) {
    reflection.after(Box, 'update', function () {
      refresh(this);
    });
    reflection.before(Box, 'dispose', function () {
      markers.delete(this);
    });
  }
  reflection.after(Overview, 'drawComponents', function () {
    if (this.artifactViewDisposed) return;
    if (views.has(this)) return;
    const view = this;
    const popup = new Popup();
    view.addChild(popup);
    views.set(view, popup);
    popup.addEventListener('artifactShareContextFavorite', (event: Game.starling.events.Event) => {
      const artifact = selectedArtifact(view, event);
      if (!artifact || view.p.getArtifactById(artifact.id) !== artifact) return;
      if (view.g.artifactRecyclePending) {
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
    popup.addEventListener('artifactShareContextShare', (event: Game.starling.events.Event) => {
      const artifact = selectedArtifact(view, event);
      const game = view.g;
      const menu = view.artifactMenu;
      const closeMenu = menu?.close;
      const chat: ArtifactComposer | null = game.chatInput;
      const insertArtifactLink = chat?.insertArtifactLink;
      const player = game.get_me();
      if (!alive || !artifact?.revealed || !closeMenu || !insertArtifactLink || !player) return;
      ToolTip.disposeType('artifactBox');
      closeMenu.call(menu);
      queueMicrotask(() => {
        if (
          alive &&
          api.game === game &&
          !game.get_isLeaving() &&
          game.get_me() === player &&
          game.chatInput === chat &&
          chat.insertArtifactLink === insertArtifactLink
        )
          insertArtifactLink.call(chat, player.id, artifact);
      });
    });
  });
  reflection.before(Overview, 'dispose', function () {
    views.get(this)?.removeFromParent(true);
    views.delete(this);
  });
  const onContext = (event: MouseEvent) => {
    const css = DomOverlay.toCss({ x: 0, y: 0, width: 1, height: 1 });
    if (!css || !(css.width > 0 && css.height > 0)) return;
    const point = new Point(
      (event.clientX - css.x) / css.width,
      (event.clientY - css.y) / css.height,
    );
    for (const [view, popup] of views) {
      const stage = view.get_stage();
      let visible = !!stage;
      for (let node: DisplayObject | null = view; node; node = node.get_parent())
        if (!node.get_visible() || node.get_alpha() <= 0) visible = false;
      if (!visible || !stage) {
        popup.close();
        continue;
      }
      if (popup.containsStagePoint(point)) {
        event.preventDefault();
        return;
      }
      let artifact: Artifact | null = null;
      for (let node = stage.hitTest(point); node && node !== view; node = node.get_parent())
        if (
          (node instanceof ArtifactCargoBox && view.cargoBoxes.includes(node)) ||
          (node instanceof ArtifactBox && view.activeSlots.includes(node))
        ) {
          artifact = node.a;
          break;
        }
      if (!artifact) {
        popup.close();
        continue;
      }
      event.preventDefault();
      event.stopPropagation();
      hideTooltips('artifactBox');
      const local = view.globalToLocal(point);
      popup.showFor(
        artifact,
        local.x,
        local.y,
        view.viewWidth ?? 665,
        view.viewHeight ?? 520,
        favorites.isFavorite(view.p.id, artifact.id),
      );
      view.setChildIndex(popup, view.get_numChildren() - 1);
      return;
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('contextmenu', onContext, true);
  api.defer(() => {
    alive = false;
    if (typeof document !== 'undefined')
      document.removeEventListener('contextmenu', onContext, true);
    for (const popup of views.values()) popup.removeFromParent(true);
    views.clear();
    for (const marker of markers.values()) marker.removeFromParent(true);
    markers.clear();
  });
  return favorites;
}
