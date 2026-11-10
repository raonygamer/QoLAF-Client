// Source port of core/hud/components/chat/rich/RichBitmapTextNavigation.as.
import { bound } from '../../runtime/As3';
import { RichBitmapEmojiResolver } from './RichBitmapEmojiResolver';

/**
 * UTF-16-safe caret navigation for the rich bitmap chat input.
 *
 * ActionScript String indexes are UTF-16 offsets. These helpers keep the
 * caret out of surrogate pairs, variation-selector pairs, and the small set
 * of emoji sequences that the chat atlas deliberately degrades to individual
 * glyphs. Keeping a sequence as one editing cluster also means backspace can
 * never leave a dangling joiner or modifier behind.
 */

export class RichBitmapTextNavigation {
  @bound
  public static isBoundary(value: string, index: number): boolean {
    value = value == null ? '' : value;
    if (index < 0 || index > value.length) {
      return false;
    }
    if (index == 0 || index == value.length) {
      return true;
    }
    let cursor: number = 0;
    while (cursor < value.length) {
      cursor = RichBitmapTextNavigation.nextClusterEnd(value, cursor);
      if (cursor == index) {
        return true;
      }
      if (cursor > index) {
        return false;
      }
    }
    return false;
  }

  @bound
  public static previousBoundary(value: string, index: number): number {
    value = value == null ? '' : value;
    index = Math.max(0, Math.min(value.length, index));
    let previous: number = 0;
    let cursor: number = 0;
    while (cursor < value.length) {
      let next: number = RichBitmapTextNavigation.nextClusterEnd(value, cursor);
      if (next >= index) {
        return previous;
      }
      previous = next;
      cursor = next;
    }
    return previous;
  }

  @bound
  public static nextBoundary(value: string, index: number): number {
    value = value == null ? '' : value;
    index = Math.max(0, Math.min(value.length, index));
    let cursor: number = 0;
    while (cursor < value.length) {
      let next: number = RichBitmapTextNavigation.nextClusterEnd(value, cursor);
      if (next > index) {
        return next;
      }
      cursor = next;
    }
    return value.length;
  }

  @bound
  public static snapBackward(value: string, index: number): number {
    value = value == null ? '' : value;
    index = Math.max(0, Math.min(value.length, index));
    if (RichBitmapTextNavigation.isBoundary(value, index)) {
      return index;
    }
    return RichBitmapTextNavigation.previousBoundary(value, index + 1);
  }

  @bound
  public static snapForward(value: string, index: number): number {
    value = value == null ? '' : value;
    index = Math.max(0, Math.min(value.length, index));
    if (RichBitmapTextNavigation.isBoundary(value, index)) {
      return index;
    }
    return RichBitmapTextNavigation.nextBoundary(value, index - 1);
  }

  /** Returns the end of the editing cluster beginning at a known boundary. */
  @bound
  public static nextClusterEnd(value: string, start: number): number {
    value = value == null ? '' : value;
    if (start < 0) {
      start = 0;
    }
    if (start >= value.length) {
      return value.length;
    }

    let first: number = RichBitmapTextNavigation.scalarAt(value, start);
    let end: number = RichBitmapTextNavigation.scalarEndWithSelector(value, start);

    // Regional indicators form flag pairs. They are not painted by the
    // current atlas, but treating a pair atomically preserves pasted text.
    if (
      RichBitmapTextNavigation.isRegionalIndicator(first) &&
      end < value.length &&
      RichBitmapTextNavigation.isRegionalIndicator(RichBitmapTextNavigation.scalarAt(value, end))
    ) {
      end = RichBitmapTextNavigation.scalarEndWithSelector(value, end);
    }

    while (end < value.length) {
      let scalar: number = RichBitmapTextNavigation.scalarAt(value, end);
      if (RichBitmapTextNavigation.isAttachedComponent(scalar)) {
        end += RichBitmapTextNavigation.scalarLengthAt(value, end);
        continue;
      }
      if (scalar != RichBitmapEmojiResolver.ZERO_WIDTH_JOINER) {
        break;
      }

      // Keep ZWJ and the following scalar with the same editing unit.
      end += RichBitmapTextNavigation.scalarLengthAt(value, end);
      if (end >= value.length) {
        break;
      }
      end = RichBitmapTextNavigation.scalarEndWithSelector(value, end);
    }
    return end;
  }

  @bound
  private static scalarEndWithSelector(value: string, start: number): number {
    let end: number = start + RichBitmapTextNavigation.scalarLengthAt(value, start);
    if (end < value.length) {
      let next: number = RichBitmapTextNavigation.scalarAt(value, end);
      if (
        next == RichBitmapEmojiResolver.TEXT_VARIATION_SELECTOR ||
        next == RichBitmapEmojiResolver.EMOJI_VARIATION_SELECTOR
      ) {
        end += RichBitmapTextNavigation.scalarLengthAt(value, end);
      }
    }
    return end;
  }

  @bound
  private static scalarLengthAt(value: string, index: number): number {
    let first: number = value.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff && index + 1 < value.length) {
      let second: number = value.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        return 2;
      }
    }
    return 1;
  }

  @bound
  private static scalarAt(value: string, index: number): number {
    let first: number = value.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff && index + 1 < value.length) {
      let second: number = value.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        return Number(0x10000 + (first - 0xd800) * 0x400 + second - 0xdc00);
      }
    }
    return Number(first);
  }

  @bound
  private static isRegionalIndicator(value: number): boolean {
    return value >= 0x1f1e6 && value <= 0x1f1ff;
  }

  @bound
  private static isAttachedComponent(value: number): boolean {
    return (
      value == 0x20e3 ||
      (value >= 0x1f3fb && value <= 0x1f3ff) ||
      (value >= 0x1f9b0 && value <= 0x1f9b3) ||
      (value >= 0xe0020 && value <= 0xe007f)
    );
  }
}
