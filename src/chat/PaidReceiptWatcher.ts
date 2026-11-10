import { PurchaseNotice } from './PurchaseNotice';

export interface ReceiptEnvironment {
  readHistory(success: (entries: Record<string, unknown>[]) => void, failure: () => void): void;
  later(callback: () => void, milliseconds: number): () => void;
  current(): boolean;
  finished?(): void;
}

/** Original PayPal receipt proof: baseline before checkout, twelve bounded retries after confirmation. */
export class PaidReceiptWatcher {
  private seen = new Set<string>();
  private newest = 0;
  private ready = false;
  private requested = false;
  private done = false;
  private tries = 0;
  private cancelRetry: (() => void) | null = null;

  constructor(
    private environment: ReceiptEnvironment,
    private base: number,
    private total: number,
    private announce: () => void,
  ) {
    try {
      environment.readHistory(
        (entries) => {
          if (this.done) return;
          if (!environment.current()) {
            this.dispose();
            return;
          }
          for (const entry of entries) {
            if (!entry) continue;
            if (typeof entry.providerTransactionId === 'string')
              this.seen.add(entry.providerTransactionId);
            const timestamp = PaidReceiptWatcher.timestamp(entry.timestamp);
            if (timestamp !== null) this.newest = Math.max(this.newest, timestamp);
          }
          this.ready = true;
          if (this.requested) this.check();
        },
        () => this.dispose(),
      );
    } catch {
      this.dispose();
    }
  }

  request(): void {
    if (this.requested || this.done) return;
    this.requested = true;
    this.check();
  }

  get finished(): boolean {
    return this.done;
  }

  dispose(): void {
    if (this.done) return;
    this.done = true;
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.environment.finished?.();
  }

  private check(): void {
    if (this.done) return;
    if (!this.environment.current()) {
      this.dispose();
      return;
    }
    if (!this.ready || this.tries >= 12) return;
    this.tries++;
    const retry = () => {
      if (this.tries >= 12 || !this.environment.current()) {
        this.dispose();
        return;
      }
      if (!this.done)
        this.cancelRetry = this.environment.later(() => {
          this.cancelRetry = null;
          this.check();
        }, 2000);
    };
    try {
      this.environment.readHistory((entries) => {
        if (this.done) return;
        if (!this.environment.current()) {
          this.dispose();
          return;
        }
        for (const entry of entries) {
          if (!PurchaseNotice.isPaidCoinReceipt(entry, this.base, this.total)) continue;
          const timestamp = PaidReceiptWatcher.timestamp(entry.timestamp);
          if (
            timestamp === null ||
            timestamp < this.newest ||
            this.seen.has(entry.providerTransactionId as string)
          )
            continue;
          this.dispose();
          this.announce();
          return;
        }
        retry();
      }, retry);
    } catch {
      retry();
    }
  }

  private static timestamp(value: unknown): number | null {
    if (Object.prototype.toString.call(value) !== '[object Date]') return null;
    const time = (value as Date).getTime();
    return Number.isFinite(time) ? time : null;
  }
}
