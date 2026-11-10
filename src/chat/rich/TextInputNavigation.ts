/** feathers.utils.text.TextInputNavigation from the original bundled feathers.swc.
 * Keep its word/punctuation rules; the rich document separately snaps atomic spans.
 */
export class TextInputNavigation {
  static previousWordStart(text: string, caret: number): number {
    if (caret <= 0) return 0;
    let nextIsWord = /\w/.test(text.charAt(caret - 1));
    for (let index = caret - 2; index >= 0; index--) {
      const isWord = /\w/.test(text.charAt(index));
      if (!isWord && nextIsWord) return index + 1;
      nextIsWord = isWord;
    }
    return 0;
  }

  static currentWordStart(text: string, caret: number): number {
    if (caret <= 0) return 0;
    let nextIsWord = /\w/.test(text.charAt(caret + 1));
    for (let index = caret; index >= 0; index--) {
      const isWord = /\w/.test(text.charAt(index));
      if (!isWord && index === caret) return this.previousWordStart(text, caret);
      if (!isWord && nextIsWord) return index + 1;
      nextIsWord = isWord;
    }
    return 0;
  }

  static currentWordEnd(text: string, caret: number): number {
    if (caret >= text.length - 1) return text.length;
    for (let index = caret; index < text.length; index++) {
      const isWord = /\w/.test(text.charAt(index));
      if (!isWord && index === caret)
        return this.currentWordEnd(text, this.nextWordStart(text, caret));
      if (!isWord) return index;
    }
    return text.length;
  }

  static nextWordStart(text: string, caret: number): number {
    if (caret >= text.length - 1) return text.length;
    let previousIsWord = !/\s/.test(text.charAt(caret));
    for (let index = caret + 1; index < text.length; index++) {
      const isWord = /\w/.test(text.charAt(index));
      if (isWord && !previousIsWord) return index;
      previousIsWord = isWord;
    }
    return text.length;
  }
}
