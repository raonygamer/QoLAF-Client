import type { Connection } from '../game/Bindings';

export interface ServiceLeaseOwner {
  readonly readyConnection: Connection | null;
  readonly chatBanMinutes: number;
  readonly chatBanAllChannels: boolean;
  release(lease: ServiceConnectionLease): void;
}

/** One consumer's ownership of a verified auxiliary Service connection. */
export class ServiceConnectionLease {
  constructor(
    private pool: ServiceLeaseOwner | null,
    private onReady: ((connection: Connection | null) => void) | null,
    private onLost: ((reason: string, kind: string) => void) | null,
  ) {}

  get connection(): Connection | null {
    return this.pool?.readyConnection ?? null;
  }
  get chatBanMinutes(): number {
    return this.pool?.chatBanMinutes ?? 0;
  }
  get chatBanAllChannels(): boolean {
    return this.pool?.chatBanAllChannels ?? false;
  }

  dispose(): void {
    const pool = this.pool;
    this.pool = null;
    this.onReady = this.onLost = null;
    pool?.release(this);
  }

  ready(connection: Connection | null): void {
    if (!this.pool) return;
    const callback = this.onReady;
    this.onReady = null;
    callback?.(connection);
  }

  lost(reason: string, kind = 'error'): void {
    if (!this.pool) return;
    const callback = this.onLost;
    this.pool = null;
    this.onReady = this.onLost = null;
    callback?.(reason, kind);
  }
}
