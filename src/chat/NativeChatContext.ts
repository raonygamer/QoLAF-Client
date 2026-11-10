import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { createChatMessageContextPopup } from '../ported/ChatMessageContextPopup';
import { ChatMessageContextData } from './ChatMessageContextData';

/** Original Advanced-chat right-click actions, using browser pointer/clipboard transport. */
export function installNativeChatContext(api: API, game: Raw, resolve: Resolve): void {
  const log = game.messageLog,
    advanced = log?.advanced;
  const stage = read(game, 'stage');
  const overlay = api.cls('core.hud.components.ui.DomOverlay');
  if (!advanced?.scroll || !stage || !overlay?.toCss) return;
  const Popup = createChatMessageContextPopup(resolve);
  const Point = resolve('openfl.geom.Point');
  const popup = new Popup();
  advanced.addChild(popup);
  const rowMessages = new WeakMap<Raw, Raw>();
  const rowStates = new Map<Raw, { touchable: boolean; cursor: boolean }>();
  const scroll = advanced.scroll;
  const clanNames = new Map<string, string>();
  let contextMessage: Raw | null = null;
  let disposed = false;
  const close = () => {
    contextMessage = null;
    popup.close(false);
  };
  const playerFor = (message: Raw) => {
    const players = game.playerManager?.playersById;
    return players?.h?.[message.playerKey] ?? players?.[message.playerKey] ?? null;
  };
  const dataFor = (message: Raw) =>
    new ChatMessageContextData(message, game.client?.connectUserId ?? '', playerFor(message));
  const refresh = (message: Raw) => {
    if (!disposed && contextMessage === message && popup.isOpen) popup.updateData(dataFor(message));
  };
  const load = (table: string, key: string, callback: (value: Raw) => void) => {
    const manager = api.cls('data.DataLocator')?.getService();
    if (!manager?.loadKeyFromBigDB) return false;
    manager.loadKeyFromBigDB(table, key, callback);
    return true;
  };
  const resolveClan = (message: Raw, id: string) => {
    if (!id) return;
    const cached = clanNames.get(id);
    if (cached) {
      message.clanName = cached;
      refresh(message);
      return;
    }
    if (message.clanName || message.contextClanLookupPending) return;
    message.contextClanLookupPending = true;
    if (
      !load('Clans', id, (clan) => {
        message.contextClanLookupPending = false;
        if (disposed) return;
        const name = ChatMessageContextData.propertyText(clan, 'name');
        if (name) {
          clanNames.set(id, name);
          message.clanName = name;
          refresh(message);
        }
      })
    )
      message.contextClanLookupPending = false;
  };
  const resolveMetadata = (message: Raw, data: ChatMessageContextData) => {
    if (data.hasClanId) {
      resolveClan(message, data.clanId);
      return;
    }
    if (
      playerFor(message) ||
      !data.hasPlayerId ||
      message.contextPlayerLookupPending ||
      message.contextPlayerLookupComplete
    )
      return;
    message.contextPlayerLookupPending = true;
    if (
      !load('PlayerObjects', data.playerId, (profile) => {
        message.contextPlayerLookupPending = false;
        if (disposed) return;
        message.contextPlayerLookupComplete = true;
        const property = ChatMessageContextData.propertyText;
        const clanId =
          property(profile, 'clanId') || property(profile, 'clan') || property(profile, 'clanKey');
        if (clanId) message.clanId = clanId;
        refresh(message);
        resolveClan(message, clanId);
      })
    )
      message.contextPlayerLookupPending = false;
  };
  api.after(advanced, 'addText', function (_result, message: Raw) {
    const count = read(scroll, 'numChildren');
    if (!count) return;
    const row = scroll.getChildAt(count - 1);
    if (!row?.field || read(row, 'text') !== message.text) return;
    rowMessages.set(row, message);
    // Source reserves left clicks for scrolling; actions belong to right click.
    if (!rowStates.has(row))
      rowStates.set(row, { touchable: read(row, 'touchable'), cursor: read(row, 'useHandCursor') });
    row.set_touchable(false);
    row.set_useHandCursor(false);
  });
  const WrapText = api.cls('core.hud.components.ui.WrapText');
  if (WrapText)
    api.around(WrapText.prototype, 'dispose', function (next, ...args) {
      rowStates.delete(this);
      return next(...args);
    });
  const descendant = (node: Raw | null, parent: Raw): boolean => {
    while (node) {
      if (node === parent) return true;
      node = read(node, 'parent');
    }
    return false;
  };
  const onContext = (event: MouseEvent) => {
    if (!log.contains(advanced)) {
      close();
      return;
    }
    for (let node: Raw | null = advanced; node; node = read(node, 'parent')) {
      if (!read(node, 'visible') || read(node, 'alpha') <= 0) {
        close();
        return;
      }
    }
    const css = overlay.toCss({ x: 0, y: 0, width: 1, height: 1 });
    if (!(css.width > 0 && css.height > 0)) return;
    const point = new Point(
      (event.clientX - css.x) / css.width,
      (event.clientY - css.y) / css.height,
    );
    if (popup.containsStagePoint(point)) {
      event.preventDefault();
      return;
    }
    const local = scroll.globalToLocal(point);
    if (
      local.x < 0 ||
      local.y < 0 ||
      local.x >= read(scroll, 'width') ||
      local.y >= read(scroll, 'height') ||
      !descendant(stage.hitTest(point), scroll)
    ) {
      close();
      return;
    }
    for (let index = read(scroll, 'numChildren') - 1; index >= 0; index--) {
      const row = scroll.getChildAt(index),
        message = rowMessages.get(row);
      if (!message || !read(row, 'visible') || read(row, 'alpha') <= 0) continue;
      const position = row.globalToLocal(point);
      if (
        position.x < 0 ||
        position.y < 0 ||
        position.x >= read(row, 'width') ||
        position.y >= read(row, 'height')
      )
        continue;
      event.preventDefault();
      event.stopPropagation();
      contextMessage = message;
      const player = playerFor(message);
      for (const key of ['id', 'clanId', 'clanName']) {
        const value = ChatMessageContextData.propertyText(player, key);
        if (value) message[key === 'id' ? 'playerId' : key] = value;
      }
      const data = dataFor(message),
        pointer = advanced.globalToLocal(point);
      const background = advanced.scrollView.getChildAt(0);
      popup.showFor(
        data,
        pointer.x,
        pointer.y,
        read(background, 'width'),
        read(background, 'height'),
      );
      advanced.setChildIndex(popup, read(advanced, 'numChildren') - 1);
      resolveMetadata(message, data);
      return;
    }
    close();
  };
  const copy = (event: Raw) => {
    if (typeof event.data === 'string')
      void navigator.clipboard
        .writeText(event.data)
        .catch((error) => api.log('Chat copy failed', error));
  };
  const block = (event: Raw) => {
    const data: ChatMessageContextData = event.data;
    if (!data?.canBlock) return;
    game.sendToServiceRoom('chatMsg', 'ignore', data.playerName);
    log.removePlayerMessages(data.playerKey);
    scroll.removeChildren(0, -1, true);
    for (const message of log.getQueue()) advanced.addText(message);
    scroll.scrollToPosition(0, read(scroll, 'maxVerticalScrollPosition'));
  };
  popup.addEventListener(Popup.COPY, copy);
  popup.addEventListener(Popup.BLOCK, block);
  popup.addEventListener(Popup.CLOSE, close);
  scroll.addEventListener('scroll', close);
  stage.addEventListener('resize', close);
  document.addEventListener('contextmenu', onContext, true);
  api.defer(() => {
    disposed = true;
    document.removeEventListener('contextmenu', onContext, true);
    scroll.removeEventListener('scroll', close);
    stage.removeEventListener('resize', close);
    popup.removeEventListener(Popup.COPY, copy);
    popup.removeEventListener(Popup.BLOCK, block);
    popup.removeEventListener(Popup.CLOSE, close);
    popup.removeFromParent(true);
    for (const [row, state] of rowStates) {
      row.set_touchable(state.touchable);
      row.set_useHandCursor(state.cursor);
    }
    rowStates.clear();
    clanNames.clear();
  });
}
