import { ChatCommandSuggestion } from './ChatCommandSuggestion';

/** Source prefix filtering, exact-command argument help, and wraparound selection. */
export class ChatCommandAutocompleteModel {
  private visibleMatches: ChatCommandSuggestion[] = [];
  selectedIndex = -1;
  query = '';
  active = false;
  argumentMode = false;
  constructor(
    private builtIns: readonly ChatCommandSuggestion[],
    private maxResults = 128,
    private customProvider: () => readonly ChatCommandSuggestion[] = () => [],
  ) {
    this.maxResults = Math.max(1, maxResults);
  }

  update(inputText: string | null): boolean {
    this.dismiss();
    this.query = '';
    if (!inputText?.startsWith('/')) return false;
    const separator = inputText.slice(1).search(/[ \t\r\n\f]/);
    this.argumentMode = separator >= 0;
    this.query = inputText.slice(1, separator < 0 ? undefined : separator + 1).toLowerCase();
    const candidates = [...this.builtIns];
    const seen = new Set(candidates.map((candidate) => candidate.commandName));
    for (const custom of this.customProvider()) {
      if (custom && !seen.has(custom.commandName)) {
        candidates.push(custom);
        seen.add(custom.commandName);
      }
    }
    candidates.sort((a, b) =>
      a.commandName < b.commandName ? -1 : a.commandName > b.commandName ? 1 : 0,
    );
    for (const candidate of candidates) {
      if (
        this.argumentMode
          ? candidate.commandName === this.query
          : candidate.commandName.startsWith(this.query)
      ) {
        this.visibleMatches.push(candidate);
        if (this.argumentMode || this.visibleMatches.length >= this.maxResults) break;
      }
    }
    this.active = this.visibleMatches.length > 0;
    this.selectedIndex = this.active ? 0 : -1;
    return this.active;
  }
  dismiss(): void {
    this.active = false;
    this.argumentMode = false;
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
  complete(): string | null {
    return this.visibleMatches[this.selectedIndex]?.completionText ?? null;
  }
}
