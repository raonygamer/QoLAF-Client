/** Public registration shape shared by the registry and automation event bus. */
export interface ChatCommandArgumentDescriptor {
  readonly name: string;
  readonly description?: string;
  readonly defaultValue?: string | number | boolean | null;
}

export type ChatCommandArgument = string | ChatCommandArgumentDescriptor;

export interface ChatCommandDescriptor {
  readonly description?: string;
  /** Legacy alias for description. */
  readonly summary?: string;
  readonly usage?: string;
  readonly mandatory?: readonly ChatCommandArgument[];
  /** Legacy alias for mandatory; mandatory takes precedence when present. */
  readonly required?: readonly ChatCommandArgument[];
  readonly optional?: readonly ChatCommandArgument[];
  readonly allowExtraArguments?: boolean;
}
