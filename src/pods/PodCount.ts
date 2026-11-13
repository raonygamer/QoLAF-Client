/** Serialize read-only counts; a reply sent before a mutation is never authoritative afterward. */
export class PodCount<T> {
  known = false;
  pending = false;
  private again = false;
  private active = true;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly options: {
      send: (reply: (value: T) => void) => void;
      apply: (value: T) => void;
      waiting: () => void;
      timeout: () => void;
      failed: () => void;
    },
  ) {}

  request(afterMutation = false): void {
    if (!this.active) return;
    this.known = false;
    if (this.pending) {
      this.again ||= afterMutation;
      return;
    }
    this.pending = true;
    const generation = ++this.generation;
    this.options.waiting();
    this.timer = setTimeout(() => {
      if (this.active && generation === this.generation && this.pending) this.options.timeout();
    }, 8000);
    try {
      this.options.send((value) => {
        if (!this.active || generation !== this.generation || !this.pending) return;
        clearTimeout(this.timer);
        this.pending = false;
        if (this.again) {
          this.again = false;
          // PlayerIO dispatches a live callback list. Register after that dispatch.
          this.refreshTimer = setTimeout(() => this.request(), 0);
          return;
        }
        try {
          this.options.apply(value);
          this.known = true;
        } catch {
          this.known = false;
          this.options.failed();
        }
      });
    } catch {
      clearTimeout(this.timer);
      this.pending = false;
      this.options.failed();
    }
  }

  dispose(): void {
    this.active = false;
    this.known = false;
    this.generation++;
    clearTimeout(this.timer);
    clearTimeout(this.refreshTimer);
  }
}
