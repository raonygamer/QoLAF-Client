/** Original bounded error evidence, independent of chat and display validation. */
export class ClientErrorDiagnostics {
  private static firstRecord = '';
  private static recentRecords: string[] = [];
  private static lastSignature = '';
  private static lastRecordTime = -2000;

  // The browser retains the original non-AIR in-memory behavior. No automatic
  // downloads, localStorage writes or remote error uploads are performed.
  static get path(): string {
    return '';
  }

  static record(error: unknown, context: string): void {
    try {
      const detail = this.describe(error).slice(0, 8192);
      const signature = context + '\n' + detail;
      const now = performance.now();
      const elapsed = now - this.lastRecordTime;
      if (signature === this.lastSignature && elapsed >= 0 && elapsed < 2000) return;
      this.lastSignature = signature;
      this.lastRecordTime = now;
      const entry = new Date().toUTCString() + ' [' + context + ']\n' + detail + '\n';
      if (!this.firstRecord) this.firstRecord = entry;
      else {
        this.recentRecords.push(entry);
        if (this.recentRecords.length > 15) this.recentRecords.shift();
      }
      console.error('[client diagnostic] ' + entry);
    } catch {
      // Diagnostics may run while unwinding an error; never throw another one.
    }
  }

  static snapshot(): string {
    return (
      this.firstRecord +
      (this.recentRecords.length ? '\nRecent errors:\n' + this.recentRecords.join('\n') : '')
    );
  }

  static flush(): void {
    // AIR's file sink is unavailable in the browser; snapshot remains readable.
  }

  private static describe(error: unknown): string {
    try {
      if (error instanceof Error) {
        const heading = error.name + ': ' + error.message;
        const stack = error.stack;
        // Firefox stacks may contain frames only, omitting the actual failure.
        return stack ? (stack.includes(heading) ? stack : heading + '\n' + stack) : heading;
      }
      return String(error);
    } catch {
      return 'Unable to format thrown value.';
    }
  }
}
