/** Original best-effort teardown: failures in cleanup or reporting cannot stop later steps. */
export class ReloadCleanupRunner {
  static run(
    steps: readonly unknown[] | null,
    onError?: (error: unknown, index: number) => void,
  ): void {
    if (!steps) return;
    const length = steps.length;
    for (let index = 0; index < length; index++) {
      const step = steps[index];
      if (typeof step !== 'function') continue;
      try {
        step();
      } catch (error) {
        try {
          onError?.(error, index);
        } catch {
          // Error reporting is teardown too.
        }
      }
    }
  }
}
