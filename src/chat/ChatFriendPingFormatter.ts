import { RichBitmapMarkupParser } from './rich/RichBitmapMarkupParser';

export interface FriendPingMatch {
  begin: number;
  end: number;
  name: string;
}

/** Source ping recognition uses visible text; formatting never crosses existing HTML tags. */
export class ChatFriendPingFormatter {
  static readonly PING_COLOR = 0x66aaff;

  static findMatches(source: string, names: readonly string[]): FriendPingMatch[] {
    if (!source?.includes('@') || !names?.length) return [];
    const visible = RichBitmapMarkupParser.parse(source, 14, 0xffffff).text;
    return this.matchVisible(visible, names);
  }

  static contains(source: string, name: string): boolean {
    return !!name && this.findMatches(source, [name]).length > 0;
  }

  static format(source: string, names: readonly string[], color = this.PING_COLOR): string {
    if (!source?.includes('@') || !names?.length) return source;
    const markup = RichBitmapMarkupParser.parse(source, 14, 0xffffff);
    const ranges: { begin: number; end: number }[] = [];
    for (const match of this.matchVisible(markup.text, names)) {
      let begin = markup.sourceStarts[match.begin];
      let end = markup.sourceEnds[match.begin];
      for (let index = match.begin + 1; index < match.end; index++) {
        const nextBegin = markup.sourceStarts[index];
        const nextEnd = markup.sourceEnds[index];
        if (nextBegin <= end) end = Math.max(end, nextEnd);
        else {
          ranges.push({ begin, end });
          begin = nextBegin;
          end = nextEnd;
        }
      }
      ranges.push({ begin, end });
    }
    const open = "<font color='#" + (color & 0xffffff).toString(16).padStart(6, '0') + "'>";
    let output = source;
    for (const { begin, end } of ranges.reverse())
      output =
        output.slice(0, begin) + open + output.slice(begin, end) + '</font>' + output.slice(end);
    return output;
  }

  private static matchVisible(visible: string, names: readonly string[]): FriendPingMatch[] {
    const unique = new Map<string, string>();
    for (const name of names) {
      const trimmed = name?.trim();
      if (trimmed && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed);
    }
    const candidates = [...unique].sort(
      ([left], [right]) => right.length - left.length || (left < right ? -1 : left > right ? 1 : 0),
    );
    const result: FriendPingMatch[] = [];
    const lower = visible.toLowerCase();
    let cursor = 0;
    while (cursor < visible.length) {
      const at = visible.indexOf('@', cursor);
      if (at < 0) break;
      cursor = at + 1;
      if (at > 0 && (visible[at - 1] === '@' || this.identifier(visible[at - 1]))) continue;
      for (const [candidate, name] of candidates) {
        const end = at + 1 + candidate.length;
        if (lower.slice(at + 1, end) !== candidate || this.identifier(visible[end])) continue;
        result.push({ begin: at, end, name });
        cursor = end;
        break;
      }
    }
    return result;
  }

  private static identifier(character: string | undefined): boolean {
    return !!character && /[a-z0-9_]/i.test(character);
  }
}
