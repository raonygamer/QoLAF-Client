import type { AutomationGame } from '../game/AutomationGame';

export class ChatCommandInvocation {
  private readonly supplied: string[];
  private readonly extra: string[];
  private readonly named: Record<string, string>;
  constructor(
    readonly fullName: string,
    readonly invokedName: string,
    readonly rawArguments: string,
    args: readonly string[],
    extra: readonly string[],
    named: Record<string, string>,
    readonly game: AutomationGame | null,
  ) {
    this.supplied = [...args];
    this.extra = [...extra];
    this.named = { ...named };
  }
  get arguments(): string[] {
    return [...this.supplied];
  }
  get extraArguments(): string[] {
    return [...this.extra];
  }
  get namedArguments(): Record<string, string> {
    return { ...this.named };
  }
  get context(): AutomationGame | null {
    return this.game;
  }
  hasArgument(name: string): boolean {
    return !!name && Object.hasOwn(this.named, name.toLowerCase());
  }
  getArgument(name: string, fallback: string | null = null): string | null {
    return this.hasArgument(name) ? this.named[name.toLowerCase()] : fallback;
  }
}

export type ChatCommandCallback = (invocation: ChatCommandInvocation) => unknown;
