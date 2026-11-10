import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendRoster } from './ChatFriendRoster';
import { ChatPingRoomResolver } from './ChatPingRoomResolver';
import { createChatFriendPingPreviewPopup } from '../ported/ChatFriendPingPreviewPopup';

interface PingHit {
  row: Raw;
  ping: ChatFriendPingData;
}
interface PingMessages {
  pingAtStagePoint(point: Raw): PingHit | null;
}

/** Source Advanced-chat ping card, retaining message snapshots while resolving remote room types. */
export function installNativeChatPingPreview(
  api: API,
  game: Raw,
  resolve: Resolve,
  messages: PingMessages,
): void {
  const stage = read(game, 'stage'),
    log = game.messageLog,
    view = log?.advanced,
    scroll = view?.scroll;
  if (!stage || !scroll) return;
  const Popup = createChatFriendPingPreviewPopup(resolve);
  const popup = new Popup();
  view.addChild(popup);
  const textures = new ChatFriendRoster(api, game);
  let hovering: (PingHit & { point: Raw; position: number }) | null = null;
  let disposed = false;
  const close = () => {
    hovering = null;
    popup.close();
  };
  const hitAt = (point: Raw): PingHit | null => {
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
    return hit ? messages.pingAtStagePoint(point) : null;
  };
  const stillHovered = () => {
    if (!hovering || read(scroll, 'verticalScrollPosition') !== hovering.position) return false;
    const current = hitAt(hovering.point);
    return current?.row === hovering.row && current.ping === hovering.ping;
  };
  const rooms = new ChatPingRoomResolver(game, (ping) => {
    if (hovering?.ping !== ping || !read(popup, 'visible')) return;
    if (stillHovered()) popup.refreshData(ping);
    else close();
  });
  const hover = (event: Raw) => {
    close();
    const touch = event.getTouch(stage, 'hover');
    if (!touch) return;
    const point = touch.getLocation(stage),
      hit = hitAt(point);
    if (!hit) return;
    hovering = { ...hit, point, position: read(scroll, 'verticalScrollPosition') };
    rooms.resolve(hit.ping);
    const local = view.globalToLocal(point),
      bounds = view.scrollView.getChildAt(0);
    popup.showFor(
      hit.ping,
      hit.ping.skin ? textures.texture(hit.ping.skin) : null,
      local.x,
      local.y,
      read(bounds, 'width'),
      read(bounds, 'height'),
    );
    view.setChildIndex(popup, read(view, 'numChildren') - 1);
  };
  stage.addEventListener('touch', hover);
  view.addEventListener('removedFromStage', close);
  api.after(log, 'updateTexts', close);
  api.on('frame', ({ game: current }) => {
    if (current === game && hovering && !stillHovered()) close();
  });
  api.defer(() => {
    disposed = true;
    close();
    rooms.dispose();
    textures.dispose();
    stage.removeEventListener('touch', hover);
    view.removeEventListener('removedFromStage', close);
    popup.removeFromParent(true);
  });
}
