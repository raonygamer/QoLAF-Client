import { RichBitmapMarkup } from '../chat/rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from '../chat/rich/RichBitmapMarkupParser';
import { RichBitmapMarkupSerializer } from '../chat/rich/RichBitmapMarkupSerializer';

/** Original bounded blocks retain formatting without splitting surrogate pairs. */
export class ClientChangelogTextChunks {
  static readonly maxVisibleUnits = 2000;
  static split(html: string): string[] {
    const parsed = RichBitmapMarkupParser.parse(html, 12, 0xffffff);
    const result: string[] = [];
    for (let begin = 0; begin < parsed.text.length; ) {
      const end = this.chooseEnd(parsed.text, begin);
      const chunk = new RichBitmapMarkup();
      chunk.text = parsed.text.slice(begin, end);
      chunk.colors = parsed.colors.slice(begin, end);
      chunk.sizes = parsed.sizes.slice(begin, end);
      result.push(RichBitmapMarkupSerializer.serialize(chunk, 12, 0xffffff));
      begin = end;
    }
    return result;
  }
  private static chooseEnd(text: string, begin: number): number {
    let end = Math.min(text.length, begin + this.maxVisibleUnits);
    if (end === text.length) return end;
    let boundary = text.lastIndexOf('\n\n', end - 2);
    if (boundary >= begin) return boundary + 2;
    boundary = text.lastIndexOf('\n', end - 1);
    if (boundary >= begin) return boundary + 1;
    for (let index = end - 1; index > begin; index--)
      if (text[index] === ' ' || text[index] === '\t') return index + 1;
    const previous = text.charCodeAt(end - 1),
      next = text.charCodeAt(end);
    if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end--;
    return end;
  }
}
