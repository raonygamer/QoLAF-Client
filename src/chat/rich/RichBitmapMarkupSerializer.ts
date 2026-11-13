// Source port of core/hud/components/chat/rich/RichBitmapMarkupSerializer.as.
import { bound } from '../../runtime/HaxeInterop';
import { RichBitmapMarkup } from './RichBitmapMarkup';
import { RichBitmapInlineAtom } from './RichBitmapInlineAtom';

import { ChatArtifactToken } from './ChatArtifactToken';

/** Canonical serializer for the editable rich-text projection. */

export class RichBitmapMarkupSerializer {
  @bound
  public static serialize(
    markup: RichBitmapMarkup,
    defaultSize: number,
    defaultColor: number,
  ): string {
    if (markup == null || markup.text.length == 0) {
      return '';
    }
    defaultSize = RichBitmapMarkupSerializer.normalizeSize(defaultSize);
    defaultColor &= 0xffffff;

    let output: any[] = [];
    let text: string = markup.text;
    let length: number = text.length;
    let start: number = 0;
    while (start < length) {
      let atom: RichBitmapInlineAtom | null = RichBitmapMarkupSerializer.validAtomStartingAt(
        markup,
        start,
        length,
      );
      let color: number = RichBitmapMarkupSerializer.colorAt(markup, start, defaultColor);
      let size: number = RichBitmapMarkupSerializer.sizeAt(markup, start, defaultSize);
      let end: number;
      if (atom != null) {
        end = atom.visibleEnd;
      } else {
        end = start + 1;
      }
      while (
        atom == null &&
        end < length &&
        RichBitmapMarkupSerializer.validAtomStartingAt(markup, end, length) == null &&
        RichBitmapMarkupSerializer.colorAt(markup, end, defaultColor) == color &&
        RichBitmapMarkupSerializer.sizeAt(markup, end, defaultSize) == size
      ) {
        end++;
      }

      let hasColor: boolean = color != defaultColor;
      let hasSize: boolean = size != defaultSize;
      if (hasColor || hasSize) {
        let opening: string = '<font';
        if (hasColor) {
          opening += " color='#" + RichBitmapMarkupSerializer.colorHex(color) + "'";
        }
        if (hasSize) {
          opening += " size='" + RichBitmapMarkupSerializer.sizeText(size) + "'";
        }
        output.push(opening + '>');
      }
      if (atom != null) {
        output.push(atom.sourceText);
      } else {
        RichBitmapMarkupSerializer.appendEscaped(text, start, end, output);
      }
      if (hasColor || hasSize) {
        output.push('</font>');
      }
      start = end;
    }
    return output.join('');
  }

  @bound
  private static validAtomStartingAt(
    markup: RichBitmapMarkup,
    index: number,
    textLength: number,
  ): RichBitmapInlineAtom | null {
    let atom: RichBitmapInlineAtom | null = markup.atomStartingAt(index);
    if (
      atom == null ||
      atom.visibleEnd <= index ||
      atom.visibleEnd > textLength ||
      atom.sourceText == null
    ) {
      return null;
    }
    let token: ChatArtifactToken | null = ChatArtifactToken.parseAt(atom.sourceText, 0);
    return token != null && token.sourceEnd == atom.sourceText.length ? atom : null;
  }

  @bound
  private static appendEscaped(value: string, start: number, end: number, output: any[]): void {
    let literalStart: number = start;
    for (let i: number = start; i < end; i++) {
      let replacement: string | null = null;
      let character: string = value.charAt(i);
      if (character == '&') {
        replacement = '&amp;';
      } else if (character == '<') {
        replacement = '&lt;';
      } else if (character == '>') {
        replacement = '&gt;';
      } else if (character == '\n' || character == '\r') {
        replacement = '<br>';
        if (character == '\r' && i + 1 < end && value.charAt(i + 1) == '\n') {
          i++;
        }
      }
      if (replacement == null) {
        continue;
      }
      if (i > literalStart) {
        output.push(value.substring(literalStart, i));
      }
      output.push(replacement);
      literalStart = i + 1;
    }
    if (literalStart < end) {
      output.push(value.substring(literalStart, end));
    }
  }

  @bound
  private static colorAt(markup: RichBitmapMarkup, index: number, fallback: number): number {
    return index < markup.colors.length ? markup.colors[index] & 0xffffff : fallback;
  }

  @bound
  private static sizeAt(markup: RichBitmapMarkup, index: number, fallback: number): number {
    return index < markup.sizes.length
      ? RichBitmapMarkupSerializer.normalizeSize(markup.sizes[index])
      : fallback;
  }

  @bound
  private static normalizeSize(value: number): number {
    if (isNaN(value) || !isFinite(value) || value <= 0) {
      return 13;
    }
    return Math.max(1, Math.min(256, value));
  }

  @bound
  private static colorHex(value: number): string {
    let result: string = (value & 0xffffff).toString(16);
    while (result.length < 6) {
      result = '0' + result;
    }
    return result;
  }

  @bound
  private static sizeText(value: number): string {
    let integer: number = value | 0;
    return value == integer ? String(integer) : String(value);
  }
}
