import { ClientIpcCodec, type IpcMessage } from './ClientIpcCodec';
import { ClientIpcMessagePack } from './ClientIpcMessagePack';
import { ClientIpcPolicy, type IpcTarget } from './ClientIpcPolicy';

export interface IpcPeerTarget {
  id: string;
  name: string;
  sessionId: string;
  seenVersion: number;
}
export interface IpcQueueHost {
  now(): number;
  nextId(): string;
  current(): boolean;
  readonly connected: boolean;
  readonly paused: boolean;
  readonly generation: number;
  peer(id: string): IpcPeerTarget | undefined;
  write(target: IpcTarget, name: string | null, frame: string): void;
  written(item: IpcQueueItem, peer: IpcPeerTarget | undefined, at: number, first: boolean): void;
  lost(reason: string): void;
}
export interface IpcSendCallbacks {
  onSent?: (() => void) | null;
  onError?: ((reason: string) => void) | null;
  beforeSend?: (() => IpcMessage | null) | null;
}
export interface IpcQueueItem extends IpcSendCallbacks {
  peerId: string | null;
  name: string | null;
  targetChannel: IpcTarget;
  frames: string[];
  index: number;
  peerSession: string | null;
  created: number;
  characters: number;
  serialized: Uint8Array | null;
  messageType: string;
  generation: number;
  internal: boolean;
  deadline?: number;
  lastProgress?: number;
  members?: IpcQueueItem[];
  packTypes?: string[];
}

/** Source paced queue, extracted from ClientIpcService without changing destinations. */
export class ClientIpcQueue {
  static readonly maxQueueMs = 120000;
  private outbound: IpcQueueItem[] = [];
  private active: IpcQueueItem | null = null;
  private queuedCharacters = 0;
  private nextPrivate = 0;
  private nextLocal = 0;
  private lastControlAt = -2000;
  constructor(private readonly host: IpcQueueHost) {}

  get hasReplyCapacity(): boolean {
    return this.length < 32 && this.queuedCharacters <= 262144 - 150;
  }
  get length(): number {
    return this.outbound.length + (this.active ? 1 : 0);
  }

  enqueue(
    peerId: string | null,
    name: string | null,
    targetChannel: IpcTarget,
    message: IpcMessage,
    callbacks: IpcSendCallbacks = {},
  ): boolean {
    if (
      (targetChannel !== 'broadcastLocal' && targetChannel !== 'peerMessage') ||
      (targetChannel === 'broadcastLocal' ? peerId !== null : peerId === null)
    )
      return ClientIpcQueue.reject(callbacks.onError, 'Invalid IPC target channel.');
    if (this.length >= 32)
      return ClientIpcQueue.reject(callbacks.onError, 'IPC send queue is full.');
    let serialized: Uint8Array, frames: string[];
    try {
      serialized = ClientIpcCodec.serialize(message);
      frames = ClientIpcCodec.framesSerialized(serialized, this.host.nextId());
    } catch (failure) {
      return ClientIpcQueue.reject(
        callbacks.onError,
        failure instanceof Error ? failure.message : String(failure),
      );
    }
    const characters = this.frameCharacters(frames);
    if (this.queuedCharacters + characters > 262144)
      return ClientIpcQueue.reject(callbacks.onError, 'IPC send queue is full.');
    this.outbound.push({
      peerId,
      name,
      targetChannel,
      frames,
      index: 0,
      peerSession: peerId === null ? null : (this.host.peer(peerId)?.sessionId ?? null),
      created: this.host.now(),
      characters,
      ...callbacks,
      serialized: callbacks.beforeSend ? null : serialized,
      messageType: message.type,
      generation: this.host.generation,
      internal: message.type.startsWith('qipc3.ipc.'),
    });
    this.queuedCharacters += characters;
    return true;
  }

  pump(now: number): void {
    if (now < this.nextPrivate) return;
    if (!this.active) this.active = this.takeNextFrame(now);
    const item = this.active;
    if (!item || (item.targetChannel === 'broadcastLocal' && now < this.nextLocal)) return;
    if (item.generation !== this.host.generation || this.expired(item, now)) {
      this.finishActive(
        item.index === 0 ? 'IPC send expired before transmission.' : 'IPC send timed out.',
      );
      return;
    }
    let peer: IpcPeerTarget | undefined;
    if (item.targetChannel === 'peerMessage') {
      peer = this.host.peer(item.peerId!);
      if (!peer) {
        this.finishActive('That player is no longer online in IPC.');
        return;
      }
      if (peer.sessionId !== item.peerSession) {
        this.finishActive('IPC peer reconnected before the message finished.');
        return;
      }
      item.name = peer.name;
    }
    if (item.index === 0 && item.beforeSend) {
      const factory = item.beforeSend;
      item.beforeSend = null;
      try {
        const prepared = factory();
        if (!this.host.current() || this.active !== item) return;
        if (
          !prepared ||
          !ClientIpcPolicy.applicationAllowed(
            prepared.type,
            item.targetChannel === 'broadcastLocal' ? 'local' : 'private',
          )
        ) {
          this.finishActive('IPC send was cancelled because its source changed.');
          return;
        }
        const bytes = ClientIpcCodec.serialize(prepared);
        const frames = ClientIpcCodec.framesSerialized(bytes, this.host.nextId());
        const characters = this.frameCharacters(frames);
        if (this.queuedCharacters - item.characters + characters > 262144) {
          this.finishActive('IPC send queue is full.');
          return;
        }
        this.queuedCharacters += characters - item.characters;
        Object.assign(item, { characters, frames, serialized: bytes, messageType: prepared.type });
      } catch {
        if (this.active === item) this.finishActive('IPC could not prepare the message.');
        return;
      }
    }
    if (!this.host.current() || !this.host.connected || this.host.paused || this.active !== item)
      return;
    if (item.index === 0) {
      item.deadline =
        now +
        30000 +
        item.frames.length * (item.targetChannel === 'broadcastLocal' ? 1000 : 200) * 2;
      item.lastProgress = now;
    }
    const body = item.frames[item.index];
    if (body.length > 150 || !ClientIpcCodec.parse(body)) {
      this.finishActive('Invalid IPC frame.');
      return;
    }
    try {
      const first = item.index === 0;
      this.host.write(item.targetChannel, item.name, body);
      const sentAt = this.host.now();
      this.host.written(item, peer, sentAt, first);
      if (item.targetChannel === 'peerMessage') {
        if (item.internal) this.lastControlAt = sentAt;
      } else this.nextLocal = sentAt + 1000;
      this.nextPrivate = sentAt + 200;
      item.lastProgress = sentAt;
      item.index++;
      if (item.index === item.frames.length) this.finishActive(null);
      else {
        this.outbound.unshift(item);
        this.active = null;
      }
    } catch {
      this.host.lost('IPC could not send the message.');
    }
  }

  private takeNextFrame(now: number): IpcQueueItem | null {
    let chosen = -1;
    if (now >= this.nextLocal) {
      const control = this.outbound.findIndex(
        (item) => item.targetChannel === 'broadcastLocal' && item.internal,
      );
      const application = this.outbound.findIndex(
        (item) => item.targetChannel === 'broadcastLocal' && !item.internal,
      );
      chosen = control >= 0 ? control : application;
    }
    if (chosen < 0) {
      const control = this.outbound.findIndex(
        (item) => item.targetChannel === 'peerMessage' && item.internal,
      );
      const application = this.outbound.findIndex(
        (item) => item.targetChannel === 'peerMessage' && !item.internal,
      );
      chosen =
        control >= 0 && (application < 0 || now - this.lastControlAt >= 2000)
          ? control
          : application;
    }
    if (chosen < 0 || !this.outbound[chosen].internal) {
      const radio = this.outbound.findIndex(
        (item) =>
          item.messageType.startsWith('qipc3.radio.') &&
          (item.targetChannel !== 'broadcastLocal' || now >= this.nextLocal),
      );
      if (radio >= 0) chosen = radio;
    }
    return chosen < 0 ? null : this.takePacked(chosen, now);
  }

  private takePacked(chosen: number, now: number): IpcQueueItem {
    const first = this.outbound.splice(chosen, 1)[0];
    if (!this.packable(first, now)) return first;
    const members = [first],
      snapshots = [first.serialized!],
      types = [first.messageType];
    let originalCharacters = first.characters;
    while (chosen < this.outbound.length && members.length < ClientIpcMessagePack.maxMessages) {
      const candidate = this.outbound[chosen];
      if (!this.packCompatible(first, candidate, now)) break;
      const trial = [...snapshots, candidate.serialized!];
      let frames: string[];
      try {
        frames = ClientIpcCodec.frames(ClientIpcMessagePack.create(trial), '000000000000');
      } catch {
        break;
      }
      if (
        frames.length !== 1 ||
        this.queuedCharacters -
          originalCharacters -
          candidate.characters +
          this.frameCharacters(frames) >
          262144
      )
        break;
      this.outbound.splice(chosen, 1);
      members.push(candidate);
      snapshots.push(candidate.serialized!);
      types.push(candidate.messageType);
      originalCharacters += candidate.characters;
    }
    if (members.length < 2) return first;
    const frames = ClientIpcCodec.frames(
      ClientIpcMessagePack.create(snapshots),
      this.host.nextId(),
    );
    const characters = this.frameCharacters(frames);
    this.queuedCharacters += characters - originalCharacters;
    return {
      ...first,
      frames,
      characters,
      serialized: null,
      messageType: ClientIpcMessagePack.type,
      members,
      packTypes: types,
      onSent: null,
      onError: null,
      beforeSend: null,
      internal: members.some((member) => member.internal),
    };
  }

  private packable(item: IpcQueueItem, now: number): boolean {
    return (
      item.index === 0 &&
      !item.beforeSend &&
      item.serialized instanceof Uint8Array &&
      item.messageType !== ClientIpcMessagePack.type &&
      !this.expired(item, now)
    );
  }
  private packCompatible(first: IpcQueueItem, candidate: IpcQueueItem, now: number): boolean {
    return (
      this.packable(candidate, now) &&
      first.targetChannel === candidate.targetChannel &&
      first.generation === candidate.generation &&
      first.internal === candidate.internal &&
      (first.targetChannel === 'broadcastLocal' ||
        (first.peerId === candidate.peerId && first.peerSession === candidate.peerSession))
    );
  }
  private expired(item: IpcQueueItem, now: number): boolean {
    return item.index === 0
      ? now - item.created >= ClientIpcQueue.maxQueueMs
      : now >= item.deadline! || now - item.lastProgress! >= 30000;
  }

  expire(now: number): void {
    if (this.active && this.expired(this.active, now)) this.finishActive('IPC send timed out.');
    this.removeQueued(
      (item) => this.expired(item, now),
      (item) => (item.index === 0 ? 'IPC send expired while queued.' : 'IPC send timed out.'),
    );
  }
  forgetPeer(id: string): void {
    const reason = 'That player is no longer online in IPC.';
    if (this.active?.peerId === id) this.finishActive(reason);
    this.removeQueued(
      (item) => item.peerId === id,
      () => reason,
    );
  }
  private removeQueued(
    matches: (item: IpcQueueItem) => boolean,
    reason: (item: IpcQueueItem) => string,
  ): void {
    for (const item of [...this.outbound]) {
      if (!matches(item)) continue;
      const index = this.outbound.indexOf(item);
      if (index < 0) continue;
      this.outbound.splice(index, 1);
      this.queuedCharacters -= item.characters;
      this.complete(item, reason(item));
    }
  }
  fail(reason: string): void {
    const pending = this.outbound;
    this.outbound = [];
    if (this.active) pending.unshift(this.active);
    this.active = null;
    this.queuedCharacters = 0;
    for (const item of pending) this.complete(item, reason);
  }
  private finishActive(reason: string | null): void {
    const item = this.active;
    if (!item) return;
    this.active = null;
    this.queuedCharacters -= item.characters;
    this.complete(item, reason);
  }
  private complete(item: IpcQueueItem, reason: string | null): void {
    if (item.members) {
      for (const member of item.members) this.complete(member, reason);
      return;
    }
    if (reason !== null) ClientIpcQueue.reject(item.onError, reason);
    else {
      try {
        item.onSent?.();
      } catch {
        /* Consumer failure does not stop the queue. */
      }
    }
  }
  private frameCharacters(frames: string[]): number {
    return frames.reduce((total, frame) => total + frame.length, 0);
  }
  static reject(callback: ((reason: string) => void) | null | undefined, reason: string): false {
    try {
      callback?.(reason);
    } catch {
      /* Match the original callback isolation. */
    }
    return false;
  }
}
