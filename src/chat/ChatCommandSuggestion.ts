/** Source command display data; runtime casing can differ from the search name. */
export class ChatCommandSuggestion {
  constructor(
    readonly commandName: string,
    readonly usage = '',
    readonly description = '',
    private readonly completionOverride?: string,
    private readonly displayOverride?: string,
    readonly emojiScalar = 0,
  ) {}
  get displayCommand(): string {
    return this.displayOverride ?? `/${this.commandName}${this.usage}`;
  }
  get completionText(): string {
    return this.completionOverride ?? `/${this.commandName} `;
  }
}
