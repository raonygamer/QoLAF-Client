import { read, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import type { ChatImageCache } from './ChatImageCache';
import { ChatDiscordImageLink } from './ChatDiscordImageLink';
import { createChatImageThumbnail } from '../ported/ChatImageThumbnail';

interface ImageEntry {
  thumbnail: Raw;
  sourceIndex: number;
}

/** ChatSimple's source spacer markup and bitmap-source attachment positions. */
export class SimpleChatImages {
  private readonly entries = new Map<Raw, ImageEntry>();
  private readonly Thumbnail: ReturnType<typeof createChatImageThumbnail>;

  constructor(
    resolve: Resolve,
    private readonly cache: ChatImageCache,
    private readonly field: Raw,
    private readonly renderer: Raw,
    private readonly invalidate: () => void,
  ) {
    this.Thumbnail = createChatImageThumbnail(resolve, cache);
  }

  prefetch(message?: Raw): void {
    if (!message || !ChatDiscordImageLink.isEmbedChannel(message.type)) return;
    const link = ChatDiscordImageLink.firstIn(String(message.text));
    if (link) this.cache.prefetch(link);
  }

  textForRows(messages: Raw[]): string {
    const used = new Set<Raw>();
    const parts: string[] = [];
    let sourceCursor = 0;
    this.renderer.validate();
    const font = this.renderer.currentTextFormat?.font;
    for (const message of messages) {
      let text = String(message.text);
      const link = ChatDiscordImageLink.isEmbedChannel(message.type)
        ? ChatDiscordImageLink.firstIn(text)
        : null;
      if (link) {
        used.add(message);
        let entry = this.entries.get(message);
        if (!entry) {
          const thumbnail = new this.Thumbnail();
          thumbnail.set_touchable(false);
          thumbnail.onPreviewSizeChanged = this.invalidate;
          this.field.addChild(thumbnail);
          entry = { thumbnail, sourceIndex: -1 };
          this.entries.set(message, entry);
        }
        entry.thumbnail.link = link;
        const height = entry.thumbnail.previewHeight;
        const size =
          font?.lineHeight > 0 && font?.size > 0 ? (height * font.size) / font.lineHeight : height;
        const spacer = `<font size='${Math.max(1, size).toFixed(2)}'> </font>`;
        const prefix = text.substring(0, link.sourceBegin);
        const suffix = text.substring(link.sourceEnd);
        text = prefix + spacer;
        entry.sourceIndex = sourceCursor + prefix.length + spacer.indexOf('>') + 1;
        if (suffix.length) {
          if (suffix.replace(/<[^>]*>/g, '').trim().length) text += '\n';
          text += ChatDiscordImageLink.simpleLabelMarkup(suffix);
        }
      }
      parts.push(text);
      sourceCursor += text.length + 1;
    }
    for (const [message, entry] of this.entries) {
      if (used.has(message)) continue;
      this.release(entry);
      this.entries.delete(message);
    }
    return parts.length ? parts.join('\n') + '\n' : '';
  }

  position(): void {
    this.renderer.validate();
    // Both nodes belong to WrapText: its clipping/vertical shift and ancestor
    // transforms apply identically to text and images, including after resize.
    for (const entry of this.entries.values()) {
      entry.thumbnail.set_x(
        Math.round(
          read(this.renderer, 'x', 0) + this.renderer.localXAtSourceIndex(entry.sourceIndex),
        ),
      );
      entry.thumbnail.set_y(
        Math.round(
          read(this.renderer, 'y', 0) + this.renderer.localYAtSourceIndex(entry.sourceIndex),
        ),
      );
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) this.release(entry);
    this.entries.clear();
  }

  private release(entry: ImageEntry): void {
    entry.thumbnail.onPreviewSizeChanged = null;
    entry.thumbnail.removeFromParent(true);
  }
}
