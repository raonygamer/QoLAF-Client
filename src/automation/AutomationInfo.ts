/** Plain metadata is accepted from separately bundled JS/TS automation modules. */
export interface AutomationMetadata {
  name: string;
  description: string;
  version: string;
  authors: readonly string[];
  min_client_version?: number;
  minClientVersion?: number;
  website?: string;
}

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
