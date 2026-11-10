import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { createChatRolePreviewPopup } from '../ported/ChatRolePreviewPopup';

interface RoleMessages {
  roleTagAtStagePoint(point: Raw, simple: boolean): string | null;
}

/** Original role cards, observing stage hover without making Simple chat interactive. */
export function installNativeChatRolePreview(
  api: API,
  game: Raw,
  resolve: Resolve,
  messages: RoleMessages,
): void {
  const stage = read(game, 'stage');
  const log = game.messageLog;
  if (!stage || !log?.simple?.tf || !log.advanced?.scroll) return;
  const Popup = createChatRolePreviewPopup(resolve);
  const Roles = resolve('core.hud.components.chat.ChatRoleTags');
  const simple = log.simple;
  const advanced = log.advanced;
  const scroll = advanced.scroll;
  const cards = [simple, advanced].map((view) => {
    const popup = new Popup();
    view.addChild(popup);
    return { view, popup };
  });
  let shown: (typeof cards)[number] | undefined;
  let scrollPosition = 0;
  let hoverPoint: Raw | null = null;
  let hoverRole: string | null = null;
  const close = () => {
    cards.forEach(({ popup }) => popup.close());
    shown = undefined;
    hoverPoint = null;
    hoverRole = null;
  };
  const visible = (view: Raw): boolean => {
    if (game.isLeaving || !log.contains(view)) return false;
    for (let node: Raw | null = view; node; node = read(node, 'parent')) {
      if (!read(node, 'visible') || read(node, 'alpha') <= 0) return false;
    }
    return !!read(view, 'stage');
  };
  const hover = (event: Raw) => {
    close();
    const touch = event.getTouch(stage, 'hover');
    if (!touch) return;
    const card = cards.find(({ view }) => visible(view));
    if (!card) return;
    const isSimple = card.view === simple;
    if (!isSimple && !read(scroll, 'touchable')) return;
    const point = touch.getLocation(stage);
    if (Roles.isCoveredBy(stage.hitTest(point), card.view)) return;
    const local = card.view.globalToLocal(point);
    const bounds = isSimple ? read(simple, 'mask') : advanced.scrollView.getChildAt(0);
    const width = read(bounds, 'width', 0);
    const height = read(bounds, 'height', 0);
    if (local.x < 0 || local.y < 0 || local.x >= width || local.y >= height) return;
    if (!isSimple) {
      let hit = stage.hitTest(point);
      while (hit && hit !== scroll) hit = read(hit, 'parent');
      if (!hit) return;
      const content = scroll.globalToLocal(point);
      if (
        content.x < 0 ||
        content.y < 0 ||
        content.x >= read(scroll, 'width') ||
        content.y >= read(scroll, 'height')
      )
        return;
    }
    const role = messages.roleTagAtStagePoint(point, isSimple);
    card.popup.showFor(role, local.x, local.y, width, height);
    if (!read(card.popup, 'visible')) return;
    card.view.setChildIndex(card.popup, read(card.view, 'numChildren') - 1);
    shown = card;
    hoverPoint = point;
    hoverRole = role;
    scrollPosition = read(scroll, 'verticalScrollPosition');
  };
  stage.addEventListener('touch', hover);
  for (const { view } of cards) view.addEventListener('removedFromStage', close);
  api.after(log, 'updateTexts', close);
  api.on('frame', ({ game: currentGame }) => {
    if (currentGame !== game || !shown) return;
    const isSimple = shown.view === simple;
    if (
      !visible(shown.view) ||
      !hoverPoint ||
      Roles.isCoveredBy(stage.hitTest(hoverPoint), shown.view) ||
      messages.roleTagAtStagePoint(hoverPoint, isSimple) !== hoverRole ||
      (!isSimple &&
        (scrollPosition !== read(scroll, 'verticalScrollPosition') || !read(scroll, 'touchable')))
    ) {
      close();
      return;
    }
    if (!isSimple) {
      let hit = stage.hitTest(hoverPoint);
      while (hit && hit !== scroll) hit = read(hit, 'parent');
      if (!hit) close();
    }
  });
  api.defer(() => {
    stage.removeEventListener('touch', hover);
    for (const { view, popup } of cards) {
      view.removeEventListener('removedFromStage', close);
      popup.removeFromParent(true);
    }
    shown = undefined;
  });
}
