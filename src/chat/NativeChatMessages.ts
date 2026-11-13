import type { SimpleChatRenderer } from './SimpleChatImages';
import { ChatPerformanceProfiler as Profiler } from './ChatPerformanceProfiler';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { RichBitmapMarkupParser } from './rich/RichBitmapMarkupParser';
import type { ChatImageCache } from './ChatImageCache';
import { ChatDiscordImageLink } from './ChatDiscordImageLink';
import { createChatImageThumbnail } from '../ported/ChatImageThumbnail';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  WrapText,
  type DisplayObject,
  type GameScene,
  type Point,
  type StarlingTextField,
} from '../game/Bindings';
import type { ChatMessage } from '../game/ChatMessage';
import type { createRichBitmapFontTextRenderer } from '../ported/RichBitmapFontTextRenderer';
import { BitmapFontTextFormat } from '../ui/BitmapFontTextFormat';
import type { Resolve } from '../runtime/HaxeInterop';
import type { DeviceSettings } from '../settings/DeviceSettings';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';
import { ChatArtifactToken } from './rich/ChatArtifactToken';
import { ChatRows } from './ChatRows';

/** Project received messages with the original rich bitmap renderer. */
export function installNativeChatMessages(
  api: API,
  game: GameScene,
  resolve: Resolve,
  preferences?: DeviceSettings,
  images?: ChatImageCache,
  artifacts?: ChatArtifactLinkResolver,
):
  | {
      simpleRenderer: SimpleChatRenderer;
      imageLinkAtStagePoint(point: Point): ChatDiscordImageLink | null;
      roleTagAtStagePoint(point: Point, simple: boolean): string | null;
      pingAtStagePoint(point: Point): { row: DisplayObject; ping: ChatFriendPingData } | null;
      artifactAtStagePoint(point: Point): { row: DisplayObject; token: ChatArtifactToken } | null;
    }
  | undefined {
  const log = game.messageLog;
  const reflection = new GameReflection(api);
  if (!log?.simple?.tf || !log.advanced?.scroll || !WrapText) return;
  const Renderer = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  ) as ReturnType<typeof createRichBitmapFontTextRenderer>;
  const Thumbnail = images ? createChatImageThumbnail(images) : null;
  const rows = new Map<
    DisplayObject,
    {
      row: WrapText;
      renderer: InstanceType<typeof Renderer>;
      field: StarlingTextField;
      alpha: number;
      index: number;
      message?: ChatMessage;
      thumbnail?: InstanceType<ReturnType<typeof createChatImageThumbnail>>;
    }
  >();
  const scroll = log.advanced.scroll;
  const materializedRows = ChatRows.install(api, log.advanced, () => log.getQueue());
  const arrangePreservingPosition = () => {
    const position = scroll.get_verticalScrollPosition();
    const followBottom = position >= scroll.get_maxVerticalScrollPosition() - 2;
    scroll.arrange();
    scroll.scrollToPosition(0, followBottom ? scroll.get_maxVerticalScrollPosition() : position);
  };
  const font = () =>
    new BitmapFontTextFormat(
      'verdana48_bitmap',
      preferences?.get('legacyChatFontSize') ?? 14,
      0xffffff,
    );
  const project = (row: WrapText) => {
    const entry = rows.get(row)!;
    const text = String(entry.field.get_text());
    const allowImages =
      !!images && ChatDiscordImageLink.isEmbedChannel(entry.message?.type ?? null);
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
    const profileStarted = Profiler.active ? Profiler.now() : 0;
    entry.renderer.validate();
    if (Profiler.active)
      Profiler.record(
        'advanced.item',
        'validate',
        Profiler.now() - profileStarted,
        text.length,
        entry.renderer.get_width() * entry.renderer.get_height(),
      );
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
      row.setChildIndex(entry.thumbnail, row.get_numChildren() - 1);
    }
  };
  const bind = (row: WrapText, message?: ChatMessage) => {
    if (!row?.field) return;
    const existing = rows.get(row);
    if (existing) {
      if (message && existing.message !== message) {
        existing.message = message;
        project(row);
      }
      return;
    }
    const renderer = new Renderer();
    renderer.artifactTokenLabelResolver = artifacts?.resolvePresentation ?? null;
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
    rows.set(row, { row, renderer, field, index, alpha: row.get_alpha(), message });
    row.removeChild(field);
    row.addChildAt(renderer, Math.max(0, index));
    row.set_alpha(1);
    project(row);
  };
  reflection.around(WrapText.prototype, 'layoutText', function (this: WrapText, next) {
    if (rows.has(this)) return project(this);
    return next();
  });
  reflection.around(WrapText.prototype, 'get_width', function (this: WrapText, next) {
    const entry = rows.get(this);
    return entry ? entry.renderer.get_width() : next();
  });
  reflection.around(WrapText.prototype, 'dispose', function (this: WrapText, next) {
    const entry = rows.get(this);
    if (entry) {
      rows.delete(this);
      if (entry.thumbnail) entry.thumbnail.onPreviewSizeChanged = null;
      // The detached upstream field still belongs to this row.
      entry.field.dispose();
    }
    return next();
  });
  api.defer(
    materializedRows.onRelease((node) => {
      const entry = rows.get(node);
      if (!entry) return;
      entry.message = undefined;
      if (entry.thumbnail) {
        entry.thumbnail.onPreviewSizeChanged = null;
        entry.thumbnail.removeFromParent(true);
        entry.thumbnail = undefined;
      }
      // Clear the retained renderer before assigning another message. In
      // particular, a new row must not inherit the previous channel's embeds.
      entry.field.set_text('');
      entry.renderer.text = '';
    }),
  );
  api.defer(
    materializedRows.subscribe(({ node, message }) => {
      bind(node, message);
      scroll.arrange();
    }),
  );
  bind(log.simple.tf);
  for (let index = 0; index < scroll.get_numChildren(); index++) {
    const row = scroll.getChildAt(index);
    if (reflection.is(row, 'core.hud.components.ui.WrapText'))
      bind(row, materializedRows.messageFor(row));
  }
  scroll.arrange();
  if (artifacts)
    api.defer(
      artifacts.onResolved(() => {
        scroll.dispatchEventWith('qolafChatMetricsChanged');
        for (const entry of rows.values()) {
          entry.renderer.refreshArtifactTokenLabels();
          entry.row.layoutText();
        }
        arrangePreservingPosition();
      }),
    );
  if (preferences)
    api.defer(
      preferences.subscribe((key) => {
        if (key !== 'legacyChatFontSize') return;
        scroll.dispatchEventWith('qolafChatMetricsChanged');
        const position = scroll.get_verticalScrollPosition();
        const followBottom = position >= scroll.get_maxVerticalScrollPosition() - 2;
        for (const entry of rows.values()) {
          entry.renderer.textFormat = font();
          project(entry.row);
        }
        // Also run Simple's viewport positioning hook after font reflow.
        log.simple.tf.set_text(log.simple.tf.get_text());
        scroll.arrange();
        scroll.scrollToPosition(
          0,
          followBottom ? scroll.get_maxVerticalScrollPosition() : position,
        );
      }),
    );
  api.defer(() => {
    for (const entry of rows.values()) {
      const row = entry.row;
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
    simpleRenderer: rows.get(log.simple.tf)!.renderer,
    pingAtStagePoint(point) {
      for (let index = scroll.get_numChildren() - 1; index >= 0; index--) {
        const row = scroll.getChildAt(index);
        const entry = rows.get(row);
        if (!entry?.message?.pings || !row.get_visible() || row.get_alpha() <= 0) continue;
        const local = entry.renderer.globalToLocal(point);
        const visibleIndex = entry.renderer.visibleTextIndexAtPoint(local.x, local.y);
        const sourceIndex = entry.renderer.sourceTextIndexAtVisibleIndex(visibleIndex);
        const source = entry.field.get_text();
        if (sourceIndex >= 0 && ChatArtifactToken.parseAt(source, sourceIndex)) continue;
        let rawVisibleIndex = visibleIndex;
        if (sourceIndex >= 0) {
          const markup = RichBitmapMarkupParser.parse(
            source,
            14,
            0xffffff,
            null,
            null,
            ChatDiscordImageLink.isEmbedChannel(entry.message.type ?? null),
            false,
          );
          rawVisibleIndex = markup.visibleIndexAtSource(sourceIndex, false);
        }
        if (rawVisibleIndex < 0) continue;
        const ping = entry.message.pings.find((ping) =>
          ping?.containsVisibleIndex(rawVisibleIndex),
        );
        if (ping) return { row, ping };
      }
      return null;
    },
    artifactAtStagePoint(point) {
      for (let index = scroll.get_numChildren() - 1; index >= 0; index--) {
        const row = scroll.getChildAt(index);
        const entry = rows.get(row);
        if (!entry || !row.get_visible() || row.get_alpha() <= 0) continue;
        const local = entry.renderer.globalToLocal(point);
        const visibleIndex = entry.renderer.visibleTextIndexAtPoint(local.x, local.y);
        const sourceIndex = entry.renderer.sourceTextIndexAtVisibleIndex(visibleIndex);
        if (sourceIndex < 0) continue;
        const token = ChatArtifactToken.parseAt(String(entry.field.get_text()), sourceIndex);
        if (token) return { row, token };
      }
      return null;
    },
    roleTagAtStagePoint(point, simple) {
      const candidates = simple
        ? [log.simple.tf]
        : Array.from({ length: scroll.get_numChildren() }, (_, i) =>
            scroll.getChildAt(i),
          ).reverse();
      for (const row of candidates) {
        const renderer = rows.get(row)?.renderer;
        if (!renderer || !row.get_visible() || row.get_alpha() <= 0) continue;
        const local = renderer.globalToLocal(point);
        const role = renderer.roleTagAtPoint(local.x, local.y);
        if (role) return role;
      }
      return null;
    },
    imageLinkAtStagePoint(point) {
      for (let index = scroll.get_numChildren() - 1; index >= 0; index--) {
        const row = scroll.getChildAt(index);
        const thumbnail = rows.get(row)?.thumbnail;
        if (
          !thumbnail?.link ||
          !row.get_visible() ||
          row.get_alpha() <= 0 ||
          !thumbnail.get_visible() ||
          !thumbnail.get_parent()
        )
          continue;
        const rowPoint = row.globalToLocal(point);
        if (
          rowPoint.x < 0 ||
          rowPoint.y < 0 ||
          rowPoint.x >= row.get_width() ||
          rowPoint.y >= row.get_height()
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
