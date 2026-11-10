// Port of af/ChatInputHistory.as; deliberately session-only.
export class ChatHistory {
  private entries: string[] = [];
  private cursor = 0;
  private draft = '';
  constructor(private limit = 100) {
    this.limit = Math.max(1, limit);
  }
  static readonly session = new ChatHistory();

  get length(): number {
    return this.entries.length;
  }

  get isBrowsing(): boolean {
    return this.cursor >= 0 && this.cursor < this.entries.length;
  }

  updateDraft(value: string): void {
    if (this.cursor === this.entries.length) this.draft = value ?? '';
  }

  begin(draft = '') {
    this.cursor = this.entries.length;
    this.draft = draft;
  }
  record(value: string) {
    if (!value) return;
    if (this.entries.at(-1) !== value) {
      this.entries.push(value);
      if (this.entries.length > this.limit) this.entries.shift();
    }
    this.begin();
  }
  previous(text: string) {
    if (!this.entries.length) return text;
    if (this.cursor === this.entries.length) this.draft = text;
    this.cursor = Math.max(0, this.cursor - 1);
    return this.entries[this.cursor];
  }
  next(text: string) {
    if (!this.entries.length) return text;
    this.cursor = Math.min(this.entries.length, this.cursor + 1);
    return this.cursor === this.entries.length ? this.draft : this.entries[this.cursor];
  }
}
