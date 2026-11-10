import { ChatCommandSuggestion } from './ChatCommandSuggestion';
import { EmojiShortcodeCatalog } from './EmojiShortcodeCatalog';

/** Original CLDR ranking buckets and wraparound selection for colon completion. */
export class ChatEmojiAutocompleteModel {
  private visibleMatches: ChatCommandSuggestion[] = [];
  private readonly suggestions: (ChatCommandSuggestion | undefined)[] = [];
  private readonly buckets: number[][] = Array.from(
    { length: EmojiShortcodeCatalog.MAX_MATCH_RANK + 1 },
    () => [],
  );
  selectedIndex = -1;
  query = '';
  active = false;
  readonly argumentMode = false;
  private readonly maxResults: number;

  constructor(maxResults = 128) {
    this.maxResults = Math.max(1, maxResults);
  }

  update(inputText: string | null): boolean {
    this.dismiss();
    this.query = inputText?.toLowerCase() ?? '';
    for (const bucket of this.buckets) bucket.length = 0;
    if (inputText === null) return false;
    for (let index = 0; index < EmojiShortcodeCatalog.ENTRY_COUNT; index++) {
      const rank = EmojiShortcodeCatalog.matchRankAt(index, this.query);
      if (rank >= 0 && rank < this.buckets.length) this.buckets[rank].push(index);
    }
    for (const bucket of this.buckets) {
      for (const index of bucket) {
        if (this.visibleMatches.length >= this.maxResults) break;
        this.visibleMatches.push(this.suggestionAt(index));
      }
      if (this.visibleMatches.length >= this.maxResults) break;
    }
    this.active = this.visibleMatches.length > 0;
    this.selectedIndex = this.active ? 0 : -1;
    return this.active;
  }

  dismiss(): void {
    this.active = false;
    this.visibleMatches = [];
    this.selectedIndex = -1;
  }
  selectNext(): void {
    if (this.active) this.selectedIndex = (this.selectedIndex + 1) % this.visibleMatches.length;
  }
  selectPrevious(): void {
    if (this.active)
      this.selectedIndex =
        (this.selectedIndex + this.visibleMatches.length - 1) % this.visibleMatches.length;
  }
  selectIndex(index: number): void {
    if (this.active && index >= 0 && index < this.visibleMatches.length) this.selectedIndex = index;
  }
  get matches(): ChatCommandSuggestion[] {
    return [...this.visibleMatches];
  }
  get selectedSuggestion(): ChatCommandSuggestion | null {
    return this.visibleMatches[this.selectedIndex] ?? null;
  }
  complete(): string | null {
    return this.selectedSuggestion?.completionText ?? null;
  }

  private suggestionAt(index: number): ChatCommandSuggestion {
    const shortcode = EmojiShortcodeCatalog.shortcodeAt(index);
    return (this.suggestions[index] ??= new ChatCommandSuggestion(
      shortcode,
      '',
      EmojiShortcodeCatalog.shortNameAt(index),
      EmojiShortcodeCatalog.emojiAt(index),
      `:${shortcode}:`,
      EmojiShortcodeCatalog.scalarAt(index),
    ));
  }
}
