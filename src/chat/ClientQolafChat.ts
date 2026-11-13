import { ClientIPCService, type IPCServerMessage } from '../ipc/ClientIPCService';
import { ClientIPCCodec, type IPCMessage } from '../ipc/ClientIPCCodec';
import { RichChatMarkupValidator } from './rich/RichChatMarkupValidator';
import { PodRewardNotice } from './PodRewardNotice';
import { RareArtifactNotice, type RewardArtifact } from './RareArtifactNotice';
import { PurchaseNotice } from './PurchaseNotice';

export interface QolafChatRow {
  kind?: 'podReward' | 'artifactReward' | 'purchase';
  body: string;
  level?: number;
  senderId: string;
  senderName: string;
  ownerId: string;
}
export interface QolafChatEnvironment {
  now(): number;
  interval(callback: () => void, ms: number): () => void;
  hash(text: string): string;
  skinName(key: string): string | null;
}
type Receiver = (row: QolafChatRow) => boolean;
type ErrorCallback = ((reason: string) => void) | null;
interface SendJob {
  error: ErrorCallback;
  receiver: Receiver | null;
  done: boolean;
}
interface RewardJob {
  message: IPCMessage;
  expiresAt: number;
  queued: boolean;
  retryAt: number;
}

/** Source authentication-owned inbox. Receivers never own the transport. */
export class ClientQolafChat {
  static readonly type = 'qipc3.chat.qolaf';
  private static singleton: ClientQolafChat | null = null;
  private readonly loginId: string;
  private receiver: Receiver | null = null;
  private pending: Array<{ row: QolafChatRow; expiresAt: number }> = [];
  private readonly sends = new Set<SendJob>();
  private readonly stopTimer: () => void;
  private draining = false;
  private disposed = false;
  private podCounter = 0;
  private rewardAnnouncements: RewardJob[] = [];
  private readonly seenRewards = new Set<string>();

  private constructor(
    private readonly ipc: ClientIPCService,
    private readonly ownerId: string,
    private ownerName: string,
    private readonly environment: QolafChatEnvironment,
  ) {
    this.loginId = ipc.loginId!;
    ipc.addMessageHandler(ClientQolafChat.type, this.onMessage);
    ipc.addMessageHandler(PodRewardNotice.type, this.onPodReward);
    ipc.addMessageHandler(RareArtifactNotice.type, this.onArtifactReward);
    ipc.addMessageHandler(PurchaseNotice.type, this.onPurchase);
    ipc.addDisposeHandler(this.dispose);
    this.stopTimer = environment.interval(() => {
      if (!this.current()) {
        this.dispose();
        return;
      }
      this.drain();
      this.pumpRewards();
    }, 1000);
  }

  static ensure(
    ipc: ClientIPCService | null,
    playerId: string,
    name: string,
    environment: QolafChatEnvironment,
  ): ClientQolafChat | null {
    if (!ipc || ipc !== ClientIPCService.instance) return null;
    const owner = ipc.ownLoginInfo();
    if (
      !owner ||
      owner.id !== playerId ||
      !this.validIdentity(playerId) ||
      !ClientIPCCodec.validId(owner.loginId)
    )
      return null;
    if (
      this.singleton &&
      (this.singleton.ipc !== ipc ||
        this.singleton.ownerId !== playerId ||
        this.singleton.loginId !== owner.loginId ||
        this.singleton.disposed)
    )
      this.shutdown();
    const validName = this.validName(name) ? name : '';
    if (!this.singleton)
      this.singleton = new ClientQolafChat(ipc, playerId, validName, environment);
    else if (validName) this.singleton.ownerName = validName;
    return this.singleton;
  }
  static shutdown(): void {
    const previous = this.singleton;
    this.singleton = null;
    previous?.dispose();
  }

  attachReceiver(callback: Receiver): void {
    if (!this.current() || !callback) return;
    if (this.receiver !== callback) {
      this.releaseReceiverErrors(this.receiver);
      this.receiver = callback;
    }
    this.drain();
  }
  detachReceiver(callback: Receiver): void {
    if (!callback) return;
    this.releaseReceiverErrors(callback);
    if (this.receiver === callback) this.receiver = null;
  }

  send(body: string, onError: ErrorCallback = null): boolean {
    if (!this.current() || !this.ipc.connected)
      return this.reject(onError, 'QoLAF chat is not connected. Try again shortly.');
    if (!ClientQolafChat.validBody(body))
      return this.reject(
        onError,
        'QoLAF messages require 1–250 characters of valid, nonblank chat text.',
      );
    const job: SendJob = { error: onError, receiver: this.receiver, done: false };
    onError = null;
    this.sends.add(job);
    let completed = false;
    const failed = (reason: string) => {
      completed = true;
      const notify = job.error,
        canNotify = this.current() && (job.receiver === null || job.receiver === this.receiver);
      if (this.finishSend(job) && canNotify) this.reject(notify, reason);
    };
    let queued: boolean;
    try {
      queued = this.ipc.broadcast(
        { type: ClientQolafChat.type, fields: [body] },
        {
          onSent: () => {
            completed = true;
            if (!this.finishSend(job)) return;
            if (this.current())
              this.enqueueRow({
                body,
                senderId: this.ownerId,
                senderName: this.ownerName || this.ownerId,
                ownerId: this.ownerId,
              });
          },
          onError: failed,
          beforeSend: () =>
            this.current() && this.sends.has(job) && !job.done
              ? { type: ClientQolafChat.type, fields: [body] }
              : null,
        },
      );
    } catch {
      failed('The QoLAF message could not be queued.');
      return false;
    }
    if (!queued && !completed) failed('The QoLAF message could not be queued.');
    return queued;
  }

  announcePodReward(
    reply: IPCServerMessage | null,
    operation: Record<string, unknown> | null,
  ): void {
    if (
      !this.current() ||
      !operation ||
      operation.type !== 'openPod' ||
      operation.podRewardAnnounced === true
    )
      return;
    const label = PodRewardNotice.fromReply(reply);
    if (label === null) return;
    operation.podRewardAnnounced = true;
    const token = this.environment.hash(`${this.loginId}:pod:${++this.podCounter}`).slice(0, 12);
    this.queueReward({ type: PodRewardNotice.type, fields: [token, label] }, 'podReward', label);
  }
  announceArtifactReward(artifact: RewardArtifact | null): void {
    if (!this.current()) return;
    const label = RareArtifactNotice.fromArtifact(artifact);
    if (!artifact || label === null || !ClientQolafChat.validIdentity(artifact.id)) return;
    const token = this.environment.hash(`${this.loginId}:artifact:${artifact.id}`).slice(0, 12);
    if (!this.rememberReward(this.ownerId, token)) return;
    this.queueReward(
      { type: RareArtifactNotice.type, fields: [token, label, artifact.level] },
      'artifactReward',
      label,
      artifact.level,
    );
  }
  announcePurchase(label: string, operation: Record<string, unknown> | null): void {
    if (
      !this.current() ||
      !operation ||
      operation.purchaseAnnounced === true ||
      !PodRewardNotice.validLabel(label)
    )
      return;
    operation.purchaseAnnounced = true;
    const token = this.environment
      .hash(`${this.loginId}:purchase:${++this.podCounter}`)
      .slice(0, 12);
    this.queueReward({ type: PurchaseNotice.type, fields: [token, label] }, 'purchase', label);
  }
  announcePurchasedSkins(
    reply: IPCServerMessage | null,
    operation: Record<string, unknown> | null,
  ): void {
    if (
      !this.current() ||
      !reply ||
      reply.fields.length < 2 ||
      !operation ||
      operation.shipsAnnounced === true ||
      reply.fields[0] !== true
    )
      return;
    operation.shipsAnnounced = true;
    const seen = new Set<string>();
    for (const key of reply.fields.slice(1, 4)) {
      if (typeof key !== 'string' || seen.has(key)) continue;
      const name = this.environment.skinName(key);
      if (typeof name !== 'string') continue;
      seen.add(key);
      this.announcePurchase(name, {});
    }
  }

  private queueReward(
    message: IPCMessage,
    kind: NonNullable<QolafChatRow['kind']>,
    body: string,
    level?: number,
  ): void {
    this.enqueueRow({
      kind,
      body,
      level,
      senderId: this.ownerId,
      senderName: this.ownerName || this.ownerId,
      ownerId: this.ownerId,
    });
    if (this.rewardAnnouncements.length >= 32) this.rewardAnnouncements.shift();
    this.rewardAnnouncements.push({
      message,
      expiresAt: this.environment.now() + 300000,
      queued: false,
      retryAt: 0,
    });
    this.pumpRewards();
  }
  private pumpRewards(): void {
    if (!this.current()) return;
    const now = this.environment.now();
    this.rewardAnnouncements = this.rewardAnnouncements.filter((job) => job.expiresAt > now);
    if (!this.ipc.connected || this.ipc.paused) return;
    for (const job of this.rewardAnnouncements) {
      if (job.queued) return;
      if (now >= job.retryAt) {
        this.sendReward(job);
        return;
      }
    }
  }
  private sendReward(job: RewardJob): void {
    job.queued = true;
    job.retryAt = this.environment.now() + 2000;
    let accepted = false;
    try {
      accepted = this.ipc.broadcast(job.message, {
        onSent: () => {
          const index = this.rewardAnnouncements.indexOf(job);
          if (index >= 0) this.rewardAnnouncements.splice(index, 1);
        },
        onError: () => {
          job.queued = false;
          job.retryAt = this.environment.now() + 2000;
        },
        beforeSend: () =>
          this.current() &&
          this.rewardAnnouncements.includes(job) &&
          this.environment.now() < job.expiresAt
            ? job.message
            : null,
      });
    } catch {
      /* A later timer retries an unqueued notice. */
    }
    if (!accepted) job.queued = false;
  }

  private readonly onMessage = (message: IPCMessage, senderId: string, senderName: string) => {
    if (
      !this.current() ||
      message.type !== ClientQolafChat.type ||
      message.fields.length !== 1 ||
      !ClientQolafChat.validIdentity(senderId) ||
      !ClientQolafChat.validName(senderName) ||
      senderId === this.ownerId ||
      !ClientQolafChat.validBody(message.fields[0])
    )
      return;
    this.enqueueRow({ body: message.fields[0], senderId, senderName, ownerId: this.ownerId });
  };
  private readonly onPodReward = (message: IPCMessage, id: string, name: string) =>
    this.receiveReward(message, id, name, 'podReward', PodRewardNotice.type);
  private readonly onArtifactReward = (message: IPCMessage, id: string, name: string) =>
    this.receiveReward(message, id, name, 'artifactReward', RareArtifactNotice.type);
  private readonly onPurchase = (message: IPCMessage, id: string, name: string) =>
    this.receiveReward(message, id, name, 'purchase', PurchaseNotice.type);
  private receiveReward(
    message: IPCMessage,
    senderId: string,
    senderName: string,
    kind: NonNullable<QolafChatRow['kind']>,
    type: string,
  ): void {
    const [token, body, level] = message.fields;
    if (
      !this.current() ||
      message.type !== type ||
      message.fields.length !== (kind === 'artifactReward' ? 3 : 2) ||
      typeof token !== 'string' ||
      !ClientIPCCodec.validId(token) ||
      !PodRewardNotice.validLabel(body) ||
      !ClientQolafChat.validIdentity(senderId) ||
      !ClientQolafChat.validName(senderName) ||
      senderId === this.ownerId
    )
      return;
    if (
      kind === 'artifactReward' &&
      (typeof level !== 'number' || !RareArtifactNotice.validLevel(level))
    )
      return;
    if (!this.rememberReward(senderId, token)) return;
    this.enqueueRow({
      kind,
      body,
      level: typeof level === 'number' ? level : undefined,
      senderId,
      senderName,
      ownerId: this.ownerId,
    });
  }
  private rememberReward(sender: string, token: string): boolean {
    const key = `${sender.length}:${sender}:${token}`;
    if (this.seenRewards.has(key)) return false;
    this.seenRewards.add(key);
    if (this.seenRewards.size > 1024)
      this.seenRewards.delete(this.seenRewards.values().next().value!);
    return true;
  }
  private finishSend(job: SendJob): boolean {
    if (job.done || !this.sends.has(job)) return false;
    job.done = true;
    job.error = job.receiver = null;
    this.sends.delete(job);
    return true;
  }
  private releaseReceiverErrors(callback: Receiver | null): void {
    if (!callback) return;
    for (const job of this.sends) if (job.receiver === callback) job.error = job.receiver = null;
  }
  private enqueueRow(row: QolafChatRow): void {
    if (!this.current()) return;
    this.prune();
    if (this.pending.length >= 64) this.pending.shift();
    this.pending.push({ row, expiresAt: this.environment.now() + 300000 });
    this.drain();
  }
  private drain(): void {
    if (this.draining || !this.current()) return;
    this.prune();
    if (!this.receiver) return;
    this.draining = true;
    try {
      while (this.current() && this.pending.length) {
        const callback: Receiver | null = this.receiver;
        if (callback === null) break;
        const entry = this.pending[0];
        let delivered = false;
        try {
          delivered = callback({ ...entry.row }) === true;
        } catch {
          /* Keep the immutable row for retry. */
        }
        if (!this.current()) return;
        if (delivered) {
          const index = this.pending.indexOf(entry);
          if (index >= 0) this.pending.splice(index, 1);
        }
        if (!delivered || this.receiver !== callback) break;
      }
    } finally {
      this.draining = false;
    }
  }
  private prune(): void {
    const now = this.environment.now();
    while (this.pending.length && this.pending[0].expiresAt <= now) this.pending.shift();
  }
  private current(): boolean {
    return (
      !this.disposed &&
      ClientQolafChat.singleton === this &&
      this.ipc === ClientIPCService.instance &&
      this.ipc.loginId === this.loginId
    );
  }
  private static validBody(body: unknown): body is string {
    return (
      typeof body === 'string' &&
      body.length > 0 &&
      body.length <= 250 &&
      body.replace(/\s/g, '').length > 0 &&
      RichChatMarkupValidator.isValid(body)
    );
  }
  private static validIdentity(value: string): boolean {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 128 &&
      !/[\x00-\x1f\x7f]/.test(value)
    );
  }
  private static validName(value: string): boolean {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 100 &&
      !/[\x00-\x1f\x7f]/.test(value)
    );
  }
  private reject(callback: ErrorCallback, reason: string): false {
    try {
      callback?.(reason);
    } catch {
      /* Isolate scene callbacks. */
    }
    return false;
  }
  readonly dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    if (ClientQolafChat.singleton === this) ClientQolafChat.singleton = null;
    this.stopTimer();
    this.ipc.removeMessageHandler(ClientQolafChat.type, this.onMessage);
    this.ipc.removeMessageHandler(PodRewardNotice.type, this.onPodReward);
    this.ipc.removeMessageHandler(RareArtifactNotice.type, this.onArtifactReward);
    this.ipc.removeMessageHandler(PurchaseNotice.type, this.onPurchase);
    this.ipc.removeDisposeHandler(this.dispose);
    this.receiver = null;
    this.pending = [];
    this.rewardAnnouncements = [];
    this.seenRewards.clear();
    for (const job of this.sends) {
      job.done = true;
      job.error = job.receiver = null;
    }
    this.sends.clear();
  };
}
