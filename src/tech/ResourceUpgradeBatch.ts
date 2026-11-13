/** Serial purchase flow: cancellation stops future requests, never rolls back an acknowledgement. */
export class ResourceUpgradeBatch<T> {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(
    private readonly options: {
      valid: (item: T) => boolean;
      send: (item: T, reply: (success: boolean) => void) => void;
      acknowledge: (item: T) => void;
      advance: (item: T) => T | null;
      finish: (failed: T | null) => void;
    },
  ) {}

  get active(): boolean {
    return this.running;
  }

  start(item: T): void {
    if (this.running || !this.options.valid(item)) return;
    this.running = true;
    this.request(item, ++this.generation);
  }

  cancel(): void {
    this.generation++;
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private request(item: T, generation: number): void {
    if (generation !== this.generation) return;
    if (!this.options.valid(item)) {
      this.cancel();
      return;
    }
    let replied = false;
    this.options.send(item, (success) => {
      if (replied) return;
      replied = true;
      if (success) this.options.acknowledge(item);
      if (generation !== this.generation) return;
      if (!this.options.valid(item)) {
        this.cancel();
        return;
      }
      const next = success ? this.options.advance(item) : null;
      if (!next) {
        this.cancel();
        this.options.finish(success ? null : item);
        return;
      }
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.request(next, generation);
      }, 50);
    });
  }
}
