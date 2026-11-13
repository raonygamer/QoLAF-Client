import type { API, Raw } from '../api/Types';

/** Defers native row arrangement to the end of a receive/refresh transaction. */
export class ChatLayoutBatch {
  private depth = 0;
  private pending = false;

  constructor(
    api: API,
    private readonly scroll: Raw,
  ) {
    api.around(scroll, 'arrange', (next, ...args) => {
      if (!this.depth) return next(...args);
      this.pending = true;
    });
  }

  run<T>(action: () => T): T {
    this.depth++;
    try {
      return action();
    } finally {
      this.depth--;
      if (!this.depth && this.pending) {
        this.pending = false;
        this.scroll.arrange();
      }
    }
  }
}
