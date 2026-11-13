// Source port of core/hud/components/chat/rich/RichBitmapTextMetrics.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
import type { BitmapChar, BitmapFont } from '../game/Bindings';
import type {} from '../game/BitmapFont';
import type { BitmapFontTextFormat } from '../ui/BitmapFontTextFormat';
import { RichBitmapEmojiMatch } from '../chat/rich/RichBitmapEmojiMatch';
import { RichBitmapEmojiResolver } from '../chat/rich/RichBitmapEmojiResolver';
import { RichBitmapTextNavigation } from '../chat/rich/RichBitmapTextNavigation';
import type { RichBitmapMarkup } from '../chat/rich/RichBitmapMarkup';
import { RichBitmapGlyph } from './RichBitmapGlyph';
import type { JapaneseCachedGlyph } from './JapaneseCachedGlyph';
import type { createJapaneseGlyphCache } from './JapaneseGlyphCache';

export function createRichBitmapTextMetrics(resolve: Resolve) {
  // Source metrics use the property aliases installed by native class resolution.
  resolve('starling.text.BitmapFont');
  resolve('starling.text.BitmapChar');
  const JapaneseGlyphCache = resolve(
    'core.hud.components.chat.rich.JapaneseGlyphCache',
  ) as ReturnType<typeof createJapaneseGlyphCache>;

  /** Allocation-conscious, single-line caret metrics shared by bitmap input. */

  class RichBitmapTextMetrics {
    private positions: number[] = [];
    private match: RichBitmapEmojiMatch = new RichBitmapEmojiMatch();
    private value: string = '';
    private measuredWidth: number = NaN;
    private measuredHeight: number = NaN;
    private measuredBaseline: number = NaN;

    @bound
    public update(
      markup: RichBitmapMarkup | null,
      format: BitmapFontTextFormat | null,
      displayAsPassword: boolean = false,
      passwordCharCode: number = 42,
      emojiScale: number = 1,
    ): void {
      this.value = markup == null ? '' : markup.text;
      this.positions.length = this.value.length + 1;
      for (let clearIndex: number = 0; clearIndex < this.positions.length; clearIndex++) {
        this.positions[clearIndex] = NaN;
      }
      this.positions[0] = 0;
      this.measuredWidth = 0;
      this.measuredHeight = 0;
      this.measuredBaseline = 0;
      if (format == null || format.font == null) {
        return;
      }

      let font: BitmapFont = format.font;
      emojiScale =
        emojiScale === emojiScale && isFinite(emojiScale) && emojiScale > 0 ? emojiScale : 1;
      let defaultScale: number =
        RichBitmapTextMetrics.normalizedSize(font, format.size) / font.size;
      this.measuredHeight = font.lineHeight * defaultScale;
      this.measuredBaseline = font.baseline * defaultScale;
      if (markup == null || this.value.length == 0) {
        return;
      }
      let cursor: number = 0;
      let visualRight: number = 0;
      let previousCharID: number = -1;
      let previousWasEmoji: boolean = false;
      let clusterStart: number = 0;

      while (clusterStart < this.value.length) {
        let clusterEnd: number = RichBitmapTextNavigation.nextClusterEnd(this.value, clusterStart);
        if (displayAsPassword) {
          let maskCharacter: BitmapChar | null = RichBitmapTextMetrics.resolveCharacter(
            font,
            passwordCharCode,
          );
          if (maskCharacter != null) {
            if (format.isKerningEnabled && previousCharID >= 0) {
              cursor += maskCharacter.getKerning(previousCharID) * defaultScale;
            }
            visualRight = Math.max(
              visualRight,
              cursor + (maskCharacter.xOffset + maskCharacter.width) * defaultScale,
            );
            cursor += maskCharacter.xAdvance * defaultScale + format.letterSpacing;
            previousCharID = maskCharacter.charID;
            previousWasEmoji = false;
          }
          this.positions[clusterEnd] = cursor;
          clusterStart = clusterEnd;
          continue;
        }
        let index: number = clusterStart;
        while (index < clusterEnd) {
          RichBitmapEmojiResolver.resolve(this.value, index, this.match);
          let consumed: number = Math.max(1, this.match.consumed);
          if (index + consumed > clusterEnd) {
            consumed = clusterEnd - index;
          }
          if (this.match.isIgnored) {
            index += consumed;
            continue;
          }

          let isEmoji: boolean = this.match.isEmoji;
          let charID: number = isEmoji ? this.match.glyphID : Number(this.match.codePoint);
          let character: BitmapChar | null = font.getChar(charID);
          let japaneseGlyph: JapaneseCachedGlyph | null = null;
          if (character == null && !isEmoji) {
            japaneseGlyph = JapaneseGlyphCache.acquire(this.match.codePoint);
            if (japaneseGlyph != null) {
              character = japaneseGlyph.character;
            }
          }
          if (character == null) {
            character = RichBitmapTextMetrics.resolveCharacter(font, charID);
          }
          let requestedSize: number =
            clusterStart < markup.sizes.length
              ? markup.sizes[clusterStart]
              : RichBitmapTextMetrics.normalizedSize(font, format.size);
          if (japaneseGlyph != null) {
            requestedSize = Math.max(20, requestedSize);
          }
          let scale: number = isEmoji
            ? (RichBitmapTextMetrics.normalizedSize(font, requestedSize) /
                RichBitmapGlyph.EMOJI_NATIVE_SIZE) *
              emojiScale
            : RichBitmapTextMetrics.normalizedSize(font, requestedSize) / font.size;

          if (character != null) {
            if (format.isKerningEnabled && previousCharID >= 0 && !previousWasEmoji && !isEmoji) {
              cursor += character.getKerning(previousCharID) * scale;
            }
            visualRight = Math.max(
              visualRight,
              cursor + (character.xOffset + character.width) * scale,
            );
            let advance: number = character.xAdvance * scale;
            if (this.match.codePoint == 9) {
              advance *= 4;
            }
            cursor += advance + format.letterSpacing;
            previousCharID = character.charID;
            previousWasEmoji = isEmoji && character.charID == charID;
            this.measuredHeight = Math.max(this.measuredHeight, font.lineHeight * scale);
            this.measuredBaseline = Math.max(this.measuredBaseline, font.baseline * scale);
          }
          JapaneseGlyphCache.release(japaneseGlyph);
          index += consumed;
        }
        this.positions[clusterEnd] = cursor;
        clusterStart = clusterEnd;
      }
      this.measuredWidth = Math.max(cursor, visualRight);
    }

    public get width(): number {
      return this.measuredWidth;
    }

    public get height(): number {
      return this.measuredHeight;
    }

    public get baseline(): number {
      return this.measuredBaseline;
    }

    @bound
    public xAt(index: number): number {
      index = RichBitmapTextNavigation.snapBackward(this.value, index);
      if (index < this.positions.length && this.positions[index] === this.positions[index]) {
        return this.positions[index];
      }
      return 0;
    }

    @bound
    public indexAt(x: number): number {
      if (x <= 0 || this.value.length == 0) {
        return 0;
      }
      let start: number = 0;
      let startX: number = 0;
      while (start < this.value.length) {
        let end: number = RichBitmapTextNavigation.nextClusterEnd(this.value, start);
        let endX: number = this.positions[end];
        if (endX !== endX) {
          endX = startX;
        }
        if (x < startX + (endX - startX) / 2) {
          return start;
        }
        if (x < endX) {
          return end;
        }
        start = end;
        startX = endX;
      }
      return this.value.length;
    }

    @bound
    private static resolveCharacter(font: BitmapFont, charID: number): BitmapChar | null {
      let character: BitmapChar | null = font.getChar(charID);
      if (character == null) {
        character = font.getChar(65533);
      }
      if (character == null) {
        character = font.getChar(63);
      }
      if (character == null) {
        character = font.getChar(32);
      }
      return character;
    }

    @bound
    private static normalizedSize(font: BitmapFont, size: number): number {
      return size === size && isFinite(size) && size > 0 ? size : font.size;
    }
  }

  return RichBitmapTextMetrics;
}
