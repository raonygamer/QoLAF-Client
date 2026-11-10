import { RichBitmapMarkup } from './rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from './rich/RichBitmapMarkupParser';
import { ChatArtifactToken } from './rich/ChatArtifactToken';
import { ChatWordBoundary } from './ChatWordBoundary';

/** Source whole-word filter: edit visible characters while preserving their markup and opaque IDs. */
export class ChatProfanityFilter {
  private readonly pattern: RegExp | null;
  private readonly terms = new Set<string>();
  private readonly parsed = new RichBitmapMarkup();

  constructor(dictionary: Record<string, unknown> | null) {
    const terms = Object.keys(dictionary ?? {})
      .map((raw) => raw.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    for (const term of terms) this.terms.add(term.toLowerCase());
    terms.sort((a, b) => b.length - a.length);
    this.pattern = terms.length
      ? new RegExp(
          terms
            .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
            .join('|'),
          'gi',
        )
      : null;
  }

  apply(source: string): string {
    if (!source || !this.pattern) return source;
    const rich =
      source.includes('<') || source.includes('&') || source.includes(ChatArtifactToken.PREFIX);
    let visible = source;
    if (rich) {
      RichBitmapMarkupParser.parse(source, 14, 0xffffff, this.parsed, () => ({
        label: '\ufffc',
        color: 0xffffff,
      }));
      visible = this.parsed.text;
    }
    this.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    let output: string[] | undefined;
    let cursor = 0;
    while ((match = this.pattern.exec(visible)) !== null) {
      const begin = match.index;
      let end = begin + match[0].length;
      if (ChatWordBoundary.isWordAt(visible, begin - 1)) {
        this.pattern.lastIndex = begin + 1;
        continue;
      }
      if (ChatWordBoundary.isWordAt(visible, end)) {
        end = this.shorterMatchEnd(visible, begin, end);
        if (end === begin) {
          this.pattern.lastIndex = begin + 1;
          continue;
        }
        this.pattern.lastIndex = end;
      }
      output ??= [];
      if (!rich) {
        output.push(source.slice(cursor, begin), visible.slice(begin, end).replace(/\S/g, '*'));
        cursor = end;
        continue;
      }
      for (let index = begin; index < end; ) {
        const from = this.parsed.sourceStarts[index];
        const to = this.parsed.sourceEnds[index];
        let next = index + 1;
        while (
          next < end &&
          this.parsed.sourceStarts[next] === from &&
          this.parsed.sourceEnds[next] === to
        )
          next++;
        if (/\s/.test(visible.charAt(index))) output.push(source.slice(cursor, to));
        else output.push(source.slice(cursor, from), '*'.repeat(next - index));
        cursor = to;
        index = next;
      }
    }
    if (!output) return source;
    output.push(source.slice(cursor));
    return output.join('');
  }

  private shorterMatchEnd(text: string, begin: number, end: number): number {
    for (let candidate = end - 1; candidate > begin; candidate--) {
      if (ChatWordBoundary.isWordAt(text, candidate)) continue;
      if (this.terms.has(text.slice(begin, candidate).replace(/\s+/g, ' ').toLowerCase()))
        return candidate;
    }
    return begin;
  }
}
