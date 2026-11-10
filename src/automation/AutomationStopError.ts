/** Expected automation refusal; the manager runs STOP cleanup without a stack report. */
export class AutomationStopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutomationStopError';
  }
}
