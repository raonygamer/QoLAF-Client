import { onChatViewInvalidation } from './ChatViewInvalidation';
import { ChatRows } from './ChatRows';
import type { API } from '../api/Types';
import {
  TextureLocator,
  type Texture,
  type DisplayObject,
  type GameScene,
  type Point,
  type TouchEvent,
} from '../game/Bindings';
import type { Resolve } from '../runtime/HaxeInterop';
import type { ChatArtifactToken } from './rich/ChatArtifactToken';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';
import type { ChatArtifactLinkData } from './ChatArtifactLinkData';
import { createChatArtifactPreviewPopup } from '../ported/ChatArtifactPreviewPopup';

interface ArtifactHit {
  row: DisplayObject;
  token: ChatArtifactToken;
}
interface ArtifactMessages {
  artifactAtStagePoint(point: Point): ArtifactHit | null;
}

/** Advanced-chat artifact cards; a late database result cannot reopen an abandoned hover. */
export function installNativeChatArtifactPreview(
  api: API,
  game: GameScene,
  resolve: Resolve,
  messages: ArtifactMessages,
  artifacts: ChatArtifactLinkResolver,
): void {
  const stage = game.get_stage();
  const log = game.messageLog;
  const view = log?.advanced;
  const scroll = view?.scroll;
  if (!stage || !log || !scroll) return;
  const Popup = createChatArtifactPreviewPopup(resolve);
  const popup = new Popup();
  view.addChild(popup);
  const textures = new Map<string, Texture | null>();
  let hovering: (ArtifactHit & { point: Point; position: number }) | null = null;
  let disposed = false;
  const close = () => {
    hovering = null;
    popup.close();
  };
  const hitAt = (point: Point): ArtifactHit | null => {
    if (disposed || game.get_isLeaving() || !log.contains(view) || !scroll.get_touchable())
      return null;
    for (let node: DisplayObject | null = view; node; node = node.get_parent())
      if (!node.get_visible() || node.get_alpha() <= 0) return null;
    if (!view.get_stage()) return null;
    const local = scroll.globalToLocal(point);
    if (
      local.x < 0 ||
      local.y < 0 ||
      local.x >= scroll.get_width() ||
      local.y >= scroll.get_height()
    )
      return null;
    let hit = stage.hitTest(point);
    while (hit && hit !== scroll) hit = hit.get_parent();
    return hit ? messages.artifactAtStagePoint(point) : null;
  };
  const stillHovered = (): boolean => {
    if (!hovering || scroll.get_verticalScrollPosition() !== hovering.position) return false;
    const current = hitAt(hovering.point);
    return (
      !!current &&
      current.row === hovering.row &&
      current.token.playerId === hovering.token.playerId &&
      current.token.artifactId === hovering.token.artifactId &&
      current.token.sourceBegin === hovering.token.sourceBegin
    );
  };
  const textureFor = (key: string): Texture | null => {
    if (!key) return null;
    if (textures.has(key)) return textures.get(key)!;
    let texture = null;
    try {
      texture = TextureLocator.getService()?.getTextureGUIByKey(key) ?? null;
    } catch {
      /* A missing atlas icon does not suppress verified artifact stats. */
    }
    textures.set(key, texture);
    return texture;
  };
  const show = (data: ChatArtifactLinkData) => {
    if (!stillHovered()) {
      close();
      return;
    }
    const point = view.globalToLocal(hovering!.point);
    const bounds = view.scrollView.getChildAt(0);
    popup.showFor(
      data,
      textureFor(data.artifact.bitmap),
      point.x,
      point.y,
      bounds.get_width(),
      bounds.get_height(),
    );
    view.setChildIndex(popup, view.get_numChildren() - 1);
  };
  const hover = (event: TouchEvent) => {
    close();
    const touch = event.getTouch(stage, 'hover');
    if (!touch) return;
    const point = touch.getLocation(stage);
    const hit = hitAt(point);
    if (!hit) return;
    hovering = { ...hit, point, position: scroll.get_verticalScrollPosition() };
    const data = artifacts.cached(hit.token.playerId, hit.token.artifactId);
    if (data) show(data);
    else artifacts.resolve(hit.token.playerId, hit.token.artifactId);
  };
  api.defer(onChatViewInvalidation(view, close));
  stage.addEventListener('touch', hover);
  view.addEventListener('removedFromStage', close);
  api.after(log, 'updateTexts', close);
  api.defer(
    artifacts.onResolved((data) => {
      if (
        hovering?.token.playerId === data.playerId &&
        hovering.token.artifactId === data.artifactId
      )
        show(data);
    }),
  );
  const checkHover = () => {
    if (hovering && !stillHovered()) close();
  };
  view.addEventListener('enterFrame', checkHover);
  api.defer(
    ChatRows.install(api, view, () => log.getQueue()).onRelease((node) => {
      if (hovering?.row === node) close();
    }),
  );
  api.defer(() => {
    disposed = true;
    close();
    stage.removeEventListener('touch', hover);
    view.removeEventListener('removedFromStage', close);
    view.removeEventListener('enterFrame', checkHover);
    popup.removeFromParent(true);
    textures.clear();
  });
}
