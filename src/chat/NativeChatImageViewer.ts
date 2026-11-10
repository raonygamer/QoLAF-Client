import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { ChatImageCache } from './ChatImageCache';
import type { ChatDiscordImageLink } from './ChatDiscordImageLink';
import { createChatImageViewerWindow } from '../ported/ChatImageViewerWindow';
import { createChatFormattingClasses } from './ChatFormattingClasses';

/** Source Advanced-chat image activation, observing native touch without selecting rows. */
export function installNativeChatImageViewer(
  api: API,
  game: Raw,
  resolve: Resolve,
  cache: ChatImageCache,
  messages: { imageLinkAtStagePoint(point: Raw): ChatDiscordImageLink | null },
): void {
  const stage = read(game, 'stage');
  const log = game.messageLog;
  const advanced = log?.advanced;
  const scroll = advanced?.scroll;
  if (!stage || !scroll) return;
  let Viewer: ReturnType<typeof createChatImageViewerWindow> | undefined;
  const onTouch = (event: Raw) => {
    if (game.isLeaving || !log.contains(advanced) || !read(scroll, 'touchable')) return;
    for (let node: Raw | null = advanced; node; node = read(node, 'parent')) {
      if (!read(node, 'visible') || read(node, 'alpha') <= 0) return;
    }
    const touch = event.getTouch(stage, 'ended');
    if (!touch) return;
    const point = touch.getLocation(stage);
    const local = scroll.globalToLocal(point);
    if (
      local.x < 0 ||
      local.y < 0 ||
      local.x >= read(scroll, 'width') ||
      local.y >= read(scroll, 'height')
    )
      return;
    let hit = stage.hitTest(point);
    while (hit && hit !== scroll) hit = read(hit, 'parent');
    if (!hit) return; // A covering window owns this click, even if rows still exist.
    const link = messages.imageLinkAtStagePoint(point);
    if (!link) return;
    Viewer ??= createChatImageViewerWindow(createChatFormattingClasses(api, resolve), cache);
    Viewer.open(game, link);
  };
  stage.addEventListener('touch', onTouch);
  api.defer(() => {
    stage.removeEventListener('touch', onTouch);
    Viewer?.closeForOwner(game);
  });
}
