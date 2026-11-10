import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { ChatArtifactToken } from './rich/ChatArtifactToken';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';
import type { ChatArtifactLinkData } from './ChatArtifactLinkData';
import { createChatArtifactPreviewPopup } from '../ported/ChatArtifactPreviewPopup';

interface ArtifactHit {
  row: Raw;
  token: ChatArtifactToken;
}
interface ArtifactMessages {
  artifactAtStagePoint(point: Raw): ArtifactHit | null;
}

/** Advanced-chat artifact cards; a late database result cannot reopen an abandoned hover. */
export function installNativeChatArtifactPreview(
  api: API,
  game: Raw,
  resolve: Resolve,
  messages: ArtifactMessages,
  artifacts: ChatArtifactLinkResolver,
): void {
  const stage = read(game, 'stage');
  const log = game.messageLog;
  const view = log?.advanced;
  const scroll = view?.scroll;
  if (!stage || !scroll) return;
  const Popup = createChatArtifactPreviewPopup(resolve);
  const popup = new Popup();
  view.addChild(popup);
  const textures = new Map<string, Raw | null>();
  let hovering: (ArtifactHit & { point: Raw; position: number }) | null = null;
  let disposed = false;
  const close = () => {
    hovering = null;
    popup.close();
  };
  const hitAt = (point: Raw): ArtifactHit | null => {
    if (disposed || game.isLeaving || !log.contains(view) || !read(scroll, 'touchable'))
      return null;
    for (let node: Raw | null = view; node; node = read(node, 'parent'))
      if (!read(node, 'visible') || read(node, 'alpha') <= 0) return null;
    if (!read(view, 'stage')) return null;
    const local = scroll.globalToLocal(point);
    if (
      local.x < 0 ||
      local.y < 0 ||
      local.x >= read(scroll, 'width') ||
      local.y >= read(scroll, 'height')
    )
      return null;
    let hit = stage.hitTest(point);
    while (hit && hit !== scroll) hit = read(hit, 'parent');
    return hit ? messages.artifactAtStagePoint(point) : null;
  };
  const stillHovered = (): boolean => {
    if (!hovering || read(scroll, 'verticalScrollPosition') !== hovering.position) return false;
    const current = hitAt(hovering.point);
    return (
      !!current &&
      current.row === hovering.row &&
      current.token.playerId === hovering.token.playerId &&
      current.token.artifactId === hovering.token.artifactId &&
      current.token.sourceBegin === hovering.token.sourceBegin
    );
  };
  const textureFor = (key: string): Raw | null => {
    if (!key) return null;
    if (textures.has(key)) return textures.get(key)!;
    let texture = null;
    try {
      texture = api.cls('textures.TextureLocator')?.getService()?.getTextureGUIByKey(key) ?? null;
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
      read(bounds, 'width'),
      read(bounds, 'height'),
    );
    view.setChildIndex(popup, read(view, 'numChildren') - 1);
  };
  const hover = (event: Raw) => {
    close();
    const touch = event.getTouch(stage, 'hover');
    if (!touch) return;
    const point = touch.getLocation(stage);
    const hit = hitAt(point);
    if (!hit) return;
    hovering = { ...hit, point, position: read(scroll, 'verticalScrollPosition') };
    const data = artifacts.cached(hit.token.playerId, hit.token.artifactId);
    if (data) show(data);
    else artifacts.resolve(hit.token.playerId, hit.token.artifactId);
  };
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
  api.on('frame', ({ game: currentGame }) => {
    if (currentGame === game && hovering && !stillHovered()) close();
  });
  api.defer(() => {
    disposed = true;
    close();
    stage.removeEventListener('touch', hover);
    view.removeEventListener('removedFromStage', close);
    popup.removeFromParent(true);
    textures.clear();
  });
}
