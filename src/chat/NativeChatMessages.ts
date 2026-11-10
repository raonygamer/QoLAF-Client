import type { ChatImageCache } from './ChatImageCache';
import { ChatDiscordImageLink } from './ChatDiscordImageLink';
import { createChatImageThumbnail } from '../ported/ChatImageThumbnail';
import { read, type API, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** Project received messages with the original rich bitmap renderer. */
export function installNativeChatMessages(
  api: API,
  game: Raw,
  resolve: Resolve,
  preferences?: DeviceSettings,
  images?: ChatImageCache,
): { imageLinkAtStagePoint(point: Raw): ChatDiscordImageLink | null } | undefined {
  const log = game.messageLog;
  const WrapText = api.cls('core.hud.components.ui.WrapText');
  if (!log?.simple?.tf || !log.advanced?.scroll || !WrapText) return;
  const Renderer = resolve('core.hud.components.chat.rich.RichBitmapFontTextRenderer');
  const BitmapFormat = resolve('feathers.text.BitmapFontTextFormat');
  const Thumbnail = images ? createChatImageThumbnail(resolve, images) : null;
  const rows = new Map<
    Raw,
    {
      renderer: Raw;
      field: Raw;
      alpha: number;
      index: number;
      message?: Raw;
      thumbnail?: Raw;
    }
  >();
  const scroll = log.advanced.scroll;
  const arrangePreservingPosition = () => {
    const position = read(scroll, 'verticalScrollPosition', 0);
    const followBottom = position >= read(scroll, 'maxVerticalScrollPosition', 0) - 2;
    scroll.arrange();
    scroll.scrollToPosition(
      0,
      followBottom ? read(scroll, 'maxVerticalScrollPosition', 0) : position,
    );
  };
  const font = () =>
    new BitmapFormat('verdana48_bitmap', preferences?.get('legacyChatFontSize') ?? 14, 0xffffff);
  const project = (row: Raw) => {
    const entry = rows.get(row)!;
    const text = String(read(entry.field, 'text', ''));
    const allowImages = !!images && ChatDiscordImageLink.isEmbedChannel(entry.message?.type);
    const link = allowImages ? ChatDiscordImageLink.firstIn(text) : null;
    if (link && !entry.thumbnail && Thumbnail) {
      const thumbnail = (entry.thumbnail = new Thumbnail());
      thumbnail.set_touchable(false);
      row.addChild(thumbnail);
      thumbnail.onPreviewSizeChanged = () => {
        if (!rows.has(row)) return;
        project(row);
        arrangePreservingPosition();
      };
    }
    if (entry.thumbnail) {
      entry.thumbnail.link = link;
      entry.thumbnail.set_visible(!!link);
    }
    entry.renderer.collapseImageLinks = allowImages;
    entry.renderer.text = text;
    entry.renderer.maxWidth = row.maxWidth > 0 ? row.maxWidth : Infinity;
    entry.renderer.set_width(row.hasWidth ? row.viewWidth : NaN);
    entry.renderer.validate();
    row.measuredWidth = entry.renderer.get_width();
    const labelHeight = entry.renderer.get_height();
    row.measuredHeight = Math.max(labelHeight, link ? (entry.thumbnail?.previewHeight ?? 0) : 0);
    entry.renderer.set_y(Math.max(0, row.measuredHeight - labelHeight));
    if (link && entry.thumbnail) {
      // ProfiledChatItemRenderer anchors the image at the message body, using
      // the source-index map rather than guessing a character width.
      const name = String(entry.message?.playerName ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const marker = name + ': ';
      const markerIndex = name ? text.lastIndexOf(marker, link.sourceBegin) : -1;
      const sourceIndex = markerIndex < 0 ? link.sourceBegin : markerIndex + marker.length;
      const x = entry.renderer.localXAtSourceIndex(sourceIndex);
      entry.thumbnail.set_x(Number.isFinite(x) ? Math.max(0, x) : 0);
      entry.thumbnail.set_y(Math.max(0, row.measuredHeight - entry.thumbnail.previewHeight));
      row.setChildIndex(entry.thumbnail, read(row, 'numChildren') - 1);
    }
  };
  const bind = (row: Raw) => {
    if (!row?.field || rows.has(row)) return;
    const renderer = new Renderer();
    renderer.textFormat = font();
    renderer.wordWrap = true;
    renderer.truncateToFit = false;
    renderer.useSeparateBatch = false;
    renderer.textureSmoothing = 'bilinear';
    renderer.pixelSnapping = row !== log.simple.tf;
    renderer.emojiScale = 1;
    renderer.animateClientDeveloperTags = true;
    renderer.animateEchoLabels = true;
    renderer.animateRoomInvites = true;
    renderer.animatePodRewards = true;
    renderer.measureWrappedWidthAtConstraint = row !== log.simple.tf;
    renderer.set_touchable(false);
    const field = row.field;
    const index = row.getChildIndex(field);
    rows.set(row, { renderer, field, index, alpha: read(row, 'alpha') });
    row.removeChild(field);
    row.addChildAt(renderer, Math.max(0, index));
    row.set_alpha(1);
    project(row);
  };
  api.around(WrapText.prototype, 'layoutText', function (next, ...args) {
    if (rows.has(this)) return project(this);
    return next(...args);
  });
  api.around(WrapText.prototype, 'get_width', function (next, ...args) {
    const entry = rows.get(this);
    return entry ? entry.renderer.get_width() : next(...args);
  });
  api.around(WrapText.prototype, 'dispose', function (next, ...args) {
    const entry = rows.get(this);
    if (entry) {
      rows.delete(this);
      if (entry.thumbnail) entry.thumbnail.onPreviewSizeChanged = null;
      // The detached upstream field still belongs to this row.
      entry.field.dispose();
    }
    return next(...args);
  });
  const bindAdvanced = (_result?: unknown, message?: Raw) => {
    for (let index = 0; index < read(scroll, 'numChildren'); index++)
      bind(scroll.getChildAt(index));
    if (message && read(scroll, 'numChildren') > 0) {
      const row = scroll.getChildAt(read(scroll, 'numChildren') - 1);
      const entry = rows.get(row);
      if (entry && read(entry.field, 'text') === message.text) {
        entry.message = message;
        project(row);
      }
    }
    scroll.arrange();
  };
  api.after(log.advanced, 'addText', bindAdvanced);
  bind(log.simple.tf);
  bindAdvanced();
  if (preferences)
    api.defer(
      preferences.subscribe((key) => {
        if (key !== 'legacyChatFontSize') return;
        const position = read(scroll, 'verticalScrollPosition');
        const followBottom = position >= read(scroll, 'maxVerticalScrollPosition') - 2;
        for (const [row, entry] of rows) {
          entry.renderer.textFormat = font();
          project(row);
        }
        // Also run Simple's viewport positioning hook after font reflow.
        log.simple.tf.set_text(read(log.simple.tf, 'text', ''));
        scroll.arrange();
        scroll.scrollToPosition(
          0,
          followBottom ? read(scroll, 'maxVerticalScrollPosition') : position,
        );
      }),
    );
  api.defer(() => {
    for (const [row, entry] of rows) {
      rows.delete(row);
      if (entry.thumbnail) {
        entry.thumbnail.onPreviewSizeChanged = null;
        entry.thumbnail.removeFromParent(true);
      }
      entry.renderer.removeFromParent(true);
      row.addChildAt(entry.field, Math.max(0, entry.index));
      row.set_alpha(entry.alpha);
      row.layoutText();
    }
    scroll.arrange();
  });
  return {
    imageLinkAtStagePoint(point) {
      for (let index = read(scroll, 'numChildren') - 1; index >= 0; index--) {
        const row = scroll.getChildAt(index);
        const thumbnail = rows.get(row)?.thumbnail;
        if (
          !thumbnail?.link ||
          !read(row, 'visible') ||
          read(row, 'alpha') <= 0 ||
          !read(thumbnail, 'visible') ||
          !read(thumbnail, 'parent')
        )
          continue;
        const rowPoint = row.globalToLocal(point);
        if (
          rowPoint.x < 0 ||
          rowPoint.y < 0 ||
          rowPoint.x >= read(row, 'width') ||
          rowPoint.y >= read(row, 'height')
        )
          continue;
        const local = thumbnail.globalToLocal(point);
        if (
          local.x >= 0 &&
          local.y >= 0 &&
          local.x < thumbnail.previewWidth &&
          local.y < thumbnail.previewHeight
        )
          return thumbnail.link;
      }
      return null;
    },
  };
}
