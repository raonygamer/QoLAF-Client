/** Match the original login timeout and reject callbacks from retired attempts. */
export class LoginAttempt {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  start(onTimeout: () => void): number {
    this.cancel();
    const attempt = this.generation;
    this.timer = setTimeout(() => {
      if (!this.isCurrent(attempt)) return;
      this.cancel();
      onTimeout();
    }, 30_000);
    return attempt;
  }

  isCurrent(attempt: number): boolean {
    return attempt === this.generation;
  }

  finish(attempt: number): boolean {
    if (!this.isCurrent(attempt)) return false;
    this.cancel();
    return true;
  }

  cancel(): void {
    this.generation++;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
