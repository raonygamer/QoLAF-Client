import { onChatViewInvalidation } from './ChatViewInvalidation';
import { ChatRows } from './ChatRows';
import type { API } from '../api/Types';
import type { DisplayObject, GameScene, Point, TouchEvent } from '../game/Bindings';
import type { Resolve } from '../runtime/HaxeInterop';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendRoster } from './ChatFriendRoster';
import { ChatPingRoomResolver } from './ChatPingRoomResolver';
import { createChatFriendPingPreviewPopup } from '../ported/ChatFriendPingPreviewPopup';

interface PingHit {
  row: DisplayObject;
  ping: ChatFriendPingData;
}
interface PingMessages {
  pingAtStagePoint(point: Point): PingHit | null;
}

/** Source Advanced-chat ping card, retaining message snapshots while resolving remote room types. */
export function installNativeChatPingPreview(
  api: API,
  game: GameScene,
  resolve: Resolve,
  messages: PingMessages,
): void {
  const stage = game.get_stage(),
    log = game.messageLog,
    view = log?.advanced,
    scroll = view?.scroll;
  if (!stage || !log || !scroll) return;
  const Popup = createChatFriendPingPreviewPopup(resolve);
  const popup = new Popup();
  view.addChild(popup);
  const textures = new ChatFriendRoster(game);
  let hovering: (PingHit & { point: Point; position: number }) | null = null;
  let disposed = false;
  const close = () => {
    hovering = null;
    popup.close();
  };
  const hitAt = (point: Point): PingHit | null => {
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
    return hit ? messages.pingAtStagePoint(point) : null;
  };
  const stillHovered = () => {
    if (!hovering || scroll.get_verticalScrollPosition() !== hovering.position) return false;
    const current = hitAt(hovering.point);
    return current?.row === hovering.row && current.ping === hovering.ping;
  };
  const rooms = new ChatPingRoomResolver(game, (ping) => {
    if (hovering?.ping !== ping || !popup.get_visible()) return;
    if (stillHovered()) popup.refreshData(ping);
    else close();
  });
  const hover = (event: TouchEvent) => {
    close();
    const touch = event.getTouch(stage, 'hover');
    if (!touch) return;
    const point = touch.getLocation(stage),
      hit = hitAt(point);
    if (!hit) return;
    hovering = { ...hit, point, position: scroll.get_verticalScrollPosition() };
    rooms.resolve(hit.ping);
    const local = view.globalToLocal(point),
      bounds = view.scrollView.getChildAt(0);
    popup.showFor(
      hit.ping,
      hit.ping.skin ? textures.texture(hit.ping.skin) : null,
      local.x,
      local.y,
      bounds.get_width(),
      bounds.get_height(),
    );
    view.setChildIndex(popup, view.get_numChildren() - 1);
  };
  api.defer(onChatViewInvalidation(view, close));
  stage.addEventListener('touch', hover);
  view.addEventListener('removedFromStage', close);
  api.after(log, 'updateTexts', close);
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
    rooms.dispose();
    textures.dispose();
    stage.removeEventListener('touch', hover);
    view.removeEventListener('removedFromStage', close);
    view.removeEventListener('enterFrame', checkHover);
    popup.removeFromParent(true);
  });
}
