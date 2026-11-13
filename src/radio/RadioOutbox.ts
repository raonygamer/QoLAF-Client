import type { IPCMessage } from '../ipc/ClientIPCCodec';
import type { IPCSendCallbacks } from '../ipc/ClientIPCQueue';
import type { RadioState } from './RadioState';

export interface RadioPacketTransport {
  peerSessionId(id: string): string | null;
  send(target: string, message: IPCMessage, callbacks: IPCSendCallbacks): boolean;
  broadcast(message: IPCMessage, callbacks: IPCSendCallbacks): boolean;
}
export type RadioPayloadKind =
  | 'state'
  | 'timeline'
  | 'ready'
  | 'leader'
  | 'takeover'
  | 'handoff'
  | 'handoffReady'
  | 'join'
  | 'joinResult'
  | 'control'
  | 'controlResult'
  | 'request'
  | 'requestResult'
  | 'kick';
interface RadioPacket {
  target: string | null;
  message: IPCMessage;
  key: string;
  roomId: string | null;
  leaderId: string | null;
  leaderSession: string | null;
  payloadKind: RadioPayloadKind | null;
  created: number;
  session: string;
  sentRevision: number;
  playback: number;
  retry: boolean;
  attempt: number;
}
export interface RadioOutboxOwner {
  readonly transport: RadioPacketTransport | null;
  readonly state: RadioState | null;
  readonly online: boolean;
  readonly closed: boolean;
  readonly host: boolean;
  readonly controller: boolean;
  readonly ownAuthority: number;
  readonly elapsed: number;
  readonly ownSession: string;
  readonly hostSession: string;
  readonly joinAttempt: string;
  readonly handoffPending: { deadline: number; revision: number } | null;
  readonly handoffOffer: { deadline: number; revision: number } | null;
  readonly controlPending: { id: number } | null;
  readonly members: ReadonlyMap<string, { session: string }>;
  hasOutstandingRequest(id: string): boolean;
  abandonRequest(id: string): void;
  snapshotMessage(): IPCMessage;
  timelineMessage(): IPCMessage;
  adoptLeader(id: string, session: string, revision: number, confirmed: boolean): void;
  readySent(playback: number, session: string): void;
  cancelHandoff(): void;
}

/** RadioRooms' paced outbox, using the port's callback-object IPC contract. */
export class RadioOutbox {
  private outbox: RadioPacket[] = [];
  private pending = new Map<string, RadioPacket>();
  private nextSend = 0;
  constructor(private owner: RadioOutboxOwner) {}

  sendSoon(): void {
    this.nextSend = this.owner.elapsed;
  }

  queue(
    target: string | null,
    message: IPCMessage,
    key: string,
    bound = false,
    payloadKind: RadioPayloadKind | null = null,
  ): boolean {
    const o = this.owner;
    if (!o.online || !message) return false;
    const queued = this.outbox.find((item) => item.key === key);
    if (queued) {
      queued.message = message;
      queued.payloadKind = payloadKind;
      return true;
    }
    if (this.pending.has(key)) return true;
    if (this.outbox.length >= 24) return false;
    const item: RadioPacket = {
      target,
      message,
      key,
      roomId: bound ? (o.state?.roomId ?? null) : null,
      leaderId: bound ? (o.state?.hostId ?? null) : null,
      leaderSession: bound ? o.hostSession : null,
      payloadKind,
      created: o.elapsed,
      session: o.ownSession,
      sentRevision: -1,
      playback: payloadKind === 'ready' ? (o.state?.playbackRevision ?? -1) : -1,
      retry: false,
      attempt: 0,
    };
    if (['timeline', 'ready', 'leader', 'takeover'].includes(payloadKind ?? ''))
      this.outbox.unshift(item);
    else this.outbox.push(item);
    return true;
  }

  flush(): void {
    const o = this.owner,
      source = o.transport;
    if (!o.online || !source || o.elapsed < this.nextSend) return;
    let selected: RadioPacket | undefined;
    const priority =
      this.outbox[0]?.payloadKind === 'ready' || this.outbox[0]?.payloadKind === 'timeline';
    for (const [key, retry] of this.pending) {
      if (!retry.retry) continue;
      if (!this.canSend(retry)) {
        this.pending.delete(key);
        this.abandon(retry);
      } else if (!priority && !selected) selected = retry;
    }
    const item = selected ?? this.outbox.shift();
    if (!item) return;
    if (!this.canSend(item)) {
      this.abandon(item);
      return;
    }
    item.retry = false;
    const attempt = ++item.attempt;
    this.nextSend = o.elapsed + (item.target === null ? 1000 : 200);
    this.pending.set(item.key, item);
    const currentAttempt = () => this.pending.get(item.key) === item && item.attempt === attempt;
    const request = item.payloadKind === 'request' || item.payloadKind === 'requestResult';
    const statePacket = item.payloadKind === 'state' || item.payloadKind === 'timeline';
    const callbacks: IPCSendCallbacks = {
      beforeSend: () => {
        if (o.transport !== source || !this.canSend(item) || (request && !currentAttempt()))
          return null;
        if (statePacket) {
          item.sentRevision = o.state?.revision ?? -1;
          return item.payloadKind === 'state' ? o.snapshotMessage() : o.timelineMessage();
        }
        return item.message;
      },
      onSent: () => {
        if (!currentAttempt()) return;
        this.pending.delete(item.key);
        if (item.payloadKind === 'leader' && this.canSend(item)) {
          o.adoptLeader(
            String(item.message.fields[2]),
            String(item.message.fields[3]),
            Number(item.message.fields[4]),
            true,
          );
          return;
        }
        if (item.payloadKind === 'ready' && this.canSend(item))
          o.readySent(item.playback, item.session);
        if (statePacket && o.host && this.canSend(item) && o.state!.revision > item.sentRevision) {
          const updated = item.payloadKind === 'state' ? o.snapshotMessage() : o.timelineMessage();
          this.queue(item.target, updated, item.key, true, item.payloadKind);
        }
      },
      onError: () => {
        if (!currentAttempt()) return;
        if (request && this.canSend(item)) {
          item.retry = true;
          return;
        }
        this.pending.delete(item.key);
        if (item.payloadKind === 'leader' || item.payloadKind === 'handoff') o.cancelHandoff();
        this.abandon(item);
      },
    };
    const accepted =
      item.target === null
        ? source.broadcast(item.message, callbacks)
        : source.send(item.target, item.message, callbacks);
    if (!accepted) callbacks.onError!('IPC did not accept the radio message.');
  }

  /** Transport reattachment discards callbacks; suspension also rejects unsent requests. */
  clear(abandonRequests = false): void {
    if (abandonRequests) {
      for (const item of this.outbox) this.abandon(item);
      for (const item of this.pending.values()) this.abandon(item);
    }
    this.outbox = [];
    this.pending.clear();
  }

  private abandon(item: RadioPacket): void {
    if (item.payloadKind === 'request') this.owner.abandonRequest(String(item.message.fields[4]));
  }

  private canSend(item: RadioPacket): boolean {
    const o = this.owner,
      state = o.state,
      kind = item.payloadKind;
    if (
      item.roomId !== null &&
      (!state || item.leaderId !== state.hostId || item.leaderSession !== o.hostSession)
    )
      return false;
    if ((kind === 'state' || kind === 'timeline' || kind === 'takeover') && !o.host) return false;
    if (
      (kind === 'handoff' || kind === 'leader') &&
      (!o.host ||
        !o.handoffPending ||
        o.elapsed >= o.handoffPending.deadline ||
        state?.revision !== o.handoffPending.revision)
    )
      return false;
    if (
      kind === 'handoffReady' &&
      (o.host ||
        !o.handoffOffer ||
        o.elapsed >= o.handoffOffer.deadline ||
        state?.revision !== o.handoffOffer.revision)
    )
      return false;
    if (kind === 'join' && item.message.fields[6] !== o.joinAttempt) return false;
    if (
      kind === 'joinResult' &&
      (!o.transport || o.transport.peerSessionId(item.target!) !== item.message.fields[2])
    )
      return false;
    const member = item.target === null ? undefined : o.members.get(item.target);
    if (
      (kind === 'state' || kind === 'timeline' || kind === 'controlResult') &&
      (!member || !o.transport || o.transport.peerSessionId(item.target!) !== member.session)
    )
      return false;
    if (kind === 'controlResult' && member?.session !== item.message.fields[2]) return false;
    if (
      kind === 'control' &&
      (!o.controlPending ||
        o.controlPending.id !== item.message.fields[4] ||
        !o.controller ||
        o.ownAuthority !== item.message.fields[3])
    )
      return false;
    if (kind === 'request' && !o.hasOutstandingRequest(String(item.message.fields[4])))
      return false;
    if (
      kind === 'requestResult' &&
      (!member ||
        member.session !== item.message.fields[2] ||
        !o.transport ||
        o.transport.peerSessionId(item.target!) !== item.message.fields[2])
    )
      return false;
    return (
      !o.closed &&
      o.online &&
      o.ownSession === item.session &&
      o.elapsed - item.created < 15000 &&
      (item.roomId === null || state?.roomId === item.roomId) &&
      (kind !== 'ready' || (!!state?.buffering && state.playbackRevision === item.playback))
    );
  }
}
