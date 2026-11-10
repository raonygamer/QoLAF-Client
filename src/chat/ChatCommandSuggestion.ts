/** Source command display data; runtime casing can differ from the search name. */
export class ChatCommandSuggestion {
  constructor(
    readonly commandName: string,
    readonly usage = '',
    readonly description = '',
    private readonly completionOverride?: string,
  ) {}
  get displayCommand(): string {
    return `/${this.commandName}${this.usage}`;
  }
  get completionText(): string {
    return this.completionOverride ?? `/${this.commandName} `;
  }
}
