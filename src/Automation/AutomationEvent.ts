import type { Raw } from '../Api/Types';

/** Original af.AutomationEvent; UPDATE uses milliseconds, RENDER uses seconds. */
export class AutomationEvent {
  static readonly INITIALIZE = 'initialize';
  static readonly START = 'start';
  static readonly STOP = 'stop';
  static readonly UPDATE = 'update';
  static readonly RENDER = 'render';
  static readonly COMMAND = 'command';
  static readonly DISPOSE = 'dispose';
  readonly timestamp = Date.now();
  private readonly arguments: string[];
  private commandHandled = false;

  constructor(
    readonly type: string,
    readonly scriptId: string,
    readonly game: Raw | null,
    readonly deltaTime = 0,
    readonly commandName = '',
    commandArguments: readonly string[] | null = null,
  ) {
    this.arguments = [...(commandArguments ?? [])];
  }

  get commandArguments(): string[] {
    return [...this.arguments];
  }
  get handled(): boolean {
    return this.commandHandled;
  }
  markHandled(): void {
    if (this.type === AutomationEvent.COMMAND) this.commandHandled = true;
  }
}
