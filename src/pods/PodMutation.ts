export type PodMutationKind = 'buyPod' | 'openPod';

export interface PendingPodMutation {
  readonly kind: PodMutationKind;
  readonly sentAt: number;
  acknowledged: boolean;
}

/** Replies have no request ID: timeout does not establish whether a purchase happened. */
export class PodMutation {
  private pending: PendingPodMutation | null = null;
  constructor(private readonly now: () => number = () => performance.now()) {}

  get current(): PendingPodMutation | null {
    return this.pending;
  }
  get expired(): boolean {
    return this.pending !== null && this.now() - this.pending.sentAt >= 8000;
  }
  begin(kind: PodMutationKind): PendingPodMutation | null {
    if (this.pending) return null;
    return (this.pending = { kind, sentAt: this.now(), acknowledged: false });
  }
  acknowledge(operation: PendingPodMutation): boolean {
    if (operation.acknowledged) return false;
    operation.acknowledged = true;
    if (this.pending === operation) this.pending = null;
    return true;
  }
}
