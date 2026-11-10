export class ChatCommandDispatchResult {
  static readonly NOT_FOUND = 'not_found';
  static readonly HANDLED = 'handled';
  static readonly PARSE_ERROR = 'parse_error';
  static readonly ARGUMENT_ERROR = 'argument_error';
  static readonly HANDLER_ERROR = 'handler_error';
  constructor(
    readonly status: string,
    readonly fullName = '',
    readonly message = '',
  ) {}
  get matched(): boolean {
    return this.status !== ChatCommandDispatchResult.NOT_FOUND;
  }
  get handled(): boolean {
    return this.status === ChatCommandDispatchResult.HANDLED;
  }
}
