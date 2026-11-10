export interface ChatFriendAutocompleteToken {
  beginIndex: number;
  endIndex: number;
  query: string;
}

/** Original @ token boundaries, using decoded editor offsets. */
export class ChatFriendAutocompleteParser {
  static find(
    text: string | null,
    selectionBegin: number,
    selectionEnd: number,
  ): ChatFriendAutocompleteToken | null {
    if (
      text === null ||
      selectionBegin !== selectionEnd ||
      selectionEnd < 0 ||
      selectionEnd > text.length
    )
      return null;
    const start = text.lastIndexOf('@', selectionEnd - 1);
    if (start < Math.max(0, selectionEnd - 65)) return null;
    if (start > 0 && /[a-z0-9_@]/i.test(text.charAt(start - 1))) return null;
    const query = text.substring(start + 1, selectionEnd);
    if (query.length > 64 || /[\n\r\t<>@]/.test(query)) return null;
    return { beginIndex: start, endIndex: selectionEnd, query };
  }
}
