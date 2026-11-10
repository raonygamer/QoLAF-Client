// Source port of core/hud/components/chat/rich/RichBitmapEmojiResolver.as.
import { bound } from '../../runtime/As3';
import { RichBitmapEmojiMatch } from './RichBitmapEmojiMatch';
import { EmojiGlyphLookup } from './EmojiGlyphLookup';

/**
 * Resolves one UTF-16 scalar for the bitmap chat renderer.
 *
 * The generated lookup deliberately contains only stand-alone emoji. Emoji
 * presentation selectors are handled here so text-default symbols retain
 * their Verdana appearance unless U+FE0F is present. Unsupported sequence
 * controls are invisible; the supported stand-alone scalars around them are
 * still rendered independently.
 */

export class RichBitmapEmojiResolver {
  public static TEXT_VARIATION_SELECTOR: number = 0xfe0e;
  public static EMOJI_VARIATION_SELECTOR: number = 0xfe0f;
  public static ZERO_WIDTH_JOINER: number = 0x200d;

  @bound
  public static resolve(
    text: string,
    utf16Index: number,
    result: RichBitmapEmojiMatch | null = null,
  ): RichBitmapEmojiMatch {
    if (result == null) {
      result = new RichBitmapEmojiMatch();
    } else {
      result.reset();
    }
    if (text == null || utf16Index < 0 || utf16Index >= text.length) {
      result.consumed = 0;
      result.isIgnored = true;
      return result;
    }

    let first: number = text.charCodeAt(utf16Index);
    let scalarLength: number = 1;
    let scalar: number = Number(first);
    if (first >= 0xd800 && first <= 0xdbff && utf16Index + 1 < text.length) {
      let low: number = text.charCodeAt(utf16Index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        scalar = Number(0x10000 + (first - 0xd800) * 0x400 + low - 0xdc00);
        scalarLength = 2;
      }
    }
    result.codePoint = scalar;
    result.consumed = scalarLength;

    if (RichBitmapEmojiResolver.isUnsupportedSequenceControl(scalar)) {
      result.isIgnored = true;
      return result;
    }

    let selector: number = 0;
    let selectorIndex: number = utf16Index + scalarLength;
    if (selectorIndex < text.length) {
      let next: number = text.charCodeAt(selectorIndex);
      if (
        next == RichBitmapEmojiResolver.TEXT_VARIATION_SELECTOR ||
        next == RichBitmapEmojiResolver.EMOJI_VARIATION_SELECTOR
      ) {
        selector = Number(next);
        result.consumed++;
      }
    }

    // FE0E always requests the ordinary bitmap font, including for
    // scalars whose default Unicode presentation is emoji.
    if (selector == RichBitmapEmojiResolver.TEXT_VARIATION_SELECTOR) {
      return result;
    }

    let glyphID: number = EmojiGlyphLookup.glyphIdForScalar(scalar);
    if (glyphID < 0) {
      return result;
    }
    if (
      EmojiGlyphLookup.requiresVS16(scalar) &&
      selector != RichBitmapEmojiResolver.EMOJI_VARIATION_SELECTOR
    ) {
      return result;
    }

    result.glyphID = glyphID;
    result.isEmoji = true;
    return result;
  }

  @bound
  public static isUnsupportedSequenceControl(scalar: number): boolean {
    // Skin-tone modifiers and joiners are intentionally excluded from the
    // atlas. Keycap and tag components are likewise meaningless without
    // sequence shaping, so omit them instead of displaying replacement
    // boxes. Adjacent base emoji remain visible.
    return (
      scalar == RichBitmapEmojiResolver.TEXT_VARIATION_SELECTOR ||
      scalar == RichBitmapEmojiResolver.EMOJI_VARIATION_SELECTOR ||
      scalar == RichBitmapEmojiResolver.ZERO_WIDTH_JOINER ||
      scalar == 0x20e3 ||
      (scalar >= 0x1f1e6 && scalar <= 0x1f1ff) ||
      (scalar >= 0x1f3fb && scalar <= 0x1f3ff) ||
      (scalar >= 0x1f9b0 && scalar <= 0x1f9b3) ||
      (scalar >= 0xe0020 && scalar <= 0xe007f)
    );
  }
}
