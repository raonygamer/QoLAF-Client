/** Metadata contract retained from af.AutomationInfo. */
export class AutomationInfo {
  private readonly authorNames: string[];
  constructor(
    readonly name: string,
    readonly description: string,
    readonly version: string,
    authors: readonly string[] | null,
    readonly minClientVersion: number,
    readonly website = '',
  ) {
    this.authorNames = [...(authors ?? [])];
  }
  get authors(): string[] {
    return [...this.authorNames];
  }
  // Existing external automation API spelling.
  get min_client_version(): number {
    return this.minClientVersion;
  }
}
