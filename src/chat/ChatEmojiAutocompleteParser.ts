export interface ChatEmojiAutocompleteToken {
  beginIndex: number;
  endIndex: number;
  query: string;
  closed: boolean;
}

/** Source shortcode parser; offsets refer to visible text, never serialized markup. */
export class ChatEmojiAutocompleteParser {
  static find(
    text: string | null,
    selectionBegin: number,
    selectionEnd: number,
  ): ChatEmojiAutocompleteToken | null {
    if (
      text === null ||
      selectionBegin !== selectionEnd ||
      selectionEnd < 0 ||
      selectionEnd > text.length
    )
      return null;
    const caret = selectionEnd;
    if (caret >= 2 && text.charAt(caret - 1) === ':') {
      const end = caret - 1;
      const start = text.lastIndexOf(':', end - 1);
      const query = text.substring(start + 1, end);
      if (
        start >= 0 &&
        start + 1 < end &&
        this.isBoundary(text, start) &&
        this.isValidQuery(query)
      ) {
        return { beginIndex: start, endIndex: caret, query, closed: true };
      }
    }
    const start = text.lastIndexOf(':', caret - 1);
    if (start < 0 || !this.isBoundary(text, start)) return null;
    const query = text.substring(start + 1, caret);
    return this.isValidQuery(query)
      ? { beginIndex: start, endIndex: caret, query, closed: false }
      : null;
  }

  private static isBoundary(text: string, index: number): boolean {
    return index === 0 || !/[a-z0-9_+\-/:\\]/i.test(text.charAt(index - 1));
  }

  private static isValidQuery(query: string): boolean {
    return /^[a-z0-9_+\-]*$/i.test(query);
  }
}
