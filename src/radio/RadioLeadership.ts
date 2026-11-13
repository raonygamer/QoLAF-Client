import type { IPCMessage } from '../ipc/ClientIPCCodec';
import type { RadioMember } from './RadioMembership';
import type { RadioState } from './RadioState';

export interface RadioHandoffOffer {
  revision: number;
  token: string;
  deadline: number;
}
export interface RadioHandoffPending extends RadioHandoffOffer {
  id: string;
  session: string;
  committing: boolean;
}
export interface RadioLeadershipOwner {
  readonly state: RadioState | null;
  readonly host: boolean;
  readonly synchronized: boolean;
  readonly online: boolean;
  readonly closed: boolean;
  readonly clockReady: boolean;
  readonly awaitingSnapshot: boolean;
  readonly elapsed: number;
  readonly ownId: string;
  readonly ownSession: string;
  readonly hostSession: string;
  readonly successorId: string;
  readonly successorSession: string;
  readonly members: ReadonlyMap<string, RadioMember>;
  peerSessionId(id: string): string | null;
  nextNonce(): number;
  sendSnapshot(id: string): void;
  awaitSnapshot(): void;
  status(message: string): void;
  queue(
    target: string | null,
    message: IPCMessage,
    key: string,
    bound: boolean,
    kind: 'handoff' | 'handoffReady' | 'leader' | 'takeover',
  ): boolean;
  adoptLeader(id: string, session: string, revision: number, keepPrevious: boolean): void;
}

/** Original two-phase leadership handoff and previously delegated disconnect succession. */
export class RadioLeadership {
  private pendingTransfer: RadioHandoffPending | null = null;
  private offeredTransfer: RadioHandoffOffer | null = null;
  private takeoverProof: IPCMessage | null = null;
  constructor(private owner: RadioLeadershipOwner) {}
  get pending(): RadioHandoffPending | null {
    return this.pendingTransfer ? { ...this.pendingTransfer } : null;
  }
  get offer(): RadioHandoffOffer | null {
    return this.offeredTransfer ? { ...this.offeredTransfer } : null;
  }
  get proof(): IPCMessage | null {
    return this.takeoverProof;
  }

  promoteLeader(id: string, session: string): boolean {
    const o = this.owner,
      state = o.state,
      member = o.members.get(id);
    if (
      !state ||
      !o.host ||
      !o.synchronized ||
      this.pendingTransfer ||
      id === o.ownId ||
      !member ||
      member.session !== session ||
      o.peerSessionId(id) !== session ||
      o.elapsed - member.seen > 65000
    )
      return false;
    const pending = (this.pendingTransfer = {
      id,
      session,
      revision: state.revision,
      token: o.ownSession + '-leader-' + o.nextNonce().toString(16),
      deadline: o.elapsed + 15000,
      committing: false,
    });
    o.sendSnapshot(id);
    o.queue(
      id,
      {
        type: 'qipc3.radio.handoff',
        fields: [o.ownSession, state.roomId, session, pending.revision, pending.token],
      },
      'handoff',
      true,
      'handoff',
    );
    o.status('Waiting for ' + member.name + ' to become leader...');
    return true;
  }

  cancel(): void {
    if (!this.pendingTransfer) return;
    this.pendingTransfer = null;
    this.owner.status('Leadership transfer did not finish. You are still the leader.');
  }

  expire(): void {
    const o = this.owner,
      pending = this.pendingTransfer;
    if (
      pending &&
      (o.elapsed >= pending.deadline ||
        !o.state ||
        o.state.revision !== pending.revision ||
        o.peerSessionId(pending.id) !== pending.session)
    )
      this.cancel();
  }

  acknowledge(): void {
    const o = this.owner,
      offer = this.offeredTransfer,
      state = o.state;
    if (
      !offer ||
      !state ||
      o.host ||
      !o.synchronized ||
      o.elapsed > offer.deadline ||
      state.revision !== offer.revision
    )
      return;
    o.queue(
      state.hostId,
      {
        type: 'qipc3.radio.handoffReady',
        fields: [o.ownSession, state.roomId, o.hostSession, offer.revision, offer.token],
      },
      'handoffReady',
      true,
      'handoffReady',
    );
  }

  receive(message: IPCMessage, sender: string): void {
    const o = this.owner,
      state = o.state,
      f = message.fields;
    if (
      o.closed ||
      !o.online ||
      !state ||
      typeof f[0] !== 'string' ||
      o.peerSessionId(sender) !== f[0]
    )
      return;
    if (message.type === 'qipc3.radio.leader' || message.type === 'qipc3.radio.takeover') {
      this.receiveLeader(message, sender);
      return;
    }
    if (
      (message.type !== 'qipc3.radio.handoff' && message.type !== 'qipc3.radio.handoffReady') ||
      f.length !== 5 ||
      f[1] !== state.roomId ||
      f[2] !== o.ownSession ||
      !this.revision(f[3]) ||
      typeof f[4] !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(f[4])
    )
      return;
    if (message.type === 'qipc3.radio.handoff') {
      if (o.host || sender !== state.hostId || f[0] !== o.hostSession || f[3] < state.revision)
        return;
      this.offeredTransfer = { revision: f[3], token: f[4], deadline: o.elapsed + 15000 };
      if (state.revision < f[3]) o.awaitSnapshot();
      this.acknowledge();
    } else {
      const pending = this.pendingTransfer;
      if (
        !o.host ||
        !pending ||
        pending.committing ||
        sender !== pending.id ||
        f[0] !== pending.session ||
        f[3] !== pending.revision ||
        f[4] !== pending.token ||
        state.revision !== pending.revision ||
        o.elapsed >= pending.deadline
      )
        return;
      pending.committing = true;
      if (
        !o.queue(
          null,
          {
            type: 'qipc3.radio.leader',
            fields: [
              o.ownSession,
              state.roomId,
              sender,
              pending.session,
              pending.revision,
              pending.token,
            ],
          },
          'leader',
          true,
          'leader',
        )
      )
        this.cancel();
    }
  }

  trySuccession(): boolean {
    const o = this.owner,
      state = o.state;
    if (
      o.host ||
      !state ||
      !o.successorId ||
      !o.clockReady ||
      !o.online ||
      o.peerSessionId(state.hostId) === o.hostSession ||
      o.successorId !== o.ownId ||
      o.successorSession !== o.ownSession ||
      state.revision < 0 ||
      o.awaitingSnapshot
    )
      return false;
    const proof: IPCMessage = {
      type: 'qipc3.radio.takeover',
      fields: [o.ownSession, state.roomId, state.hostId, o.hostSession, state.revision, ''],
    };
    o.adoptLeader(o.ownId, o.ownSession, state.revision, false);
    this.takeoverProof = proof;
    o.queue(null, proof, 'takeover', true, 'takeover');
    return true;
  }

  clear(): void {
    this.pendingTransfer = null;
    this.offeredTransfer = null;
    this.takeoverProof = null;
  }

  private receiveLeader(message: IPCMessage, sender: string): void {
    const o = this.owner,
      state = o.state!,
      f = message.fields;
    if (
      o.host ||
      f.length !== 6 ||
      f[1] !== state.roomId ||
      !this.text(f[2]) ||
      !this.text(f[3]) ||
      !this.revision(f[4]) ||
      typeof f[5] !== 'string'
    )
      return;
    if (message.type === 'qipc3.radio.takeover') {
      if (
        sender !== o.successorId ||
        f[0] !== o.successorSession ||
        f[2] !== state.hostId ||
        f[3] !== o.hostSession ||
        o.peerSessionId(state.hostId) === o.hostSession
      )
        return;
      o.adoptLeader(sender, String(f[0]), f[4], false);
    } else {
      if (
        sender !== state.hostId ||
        f[0] !== o.hostSession ||
        f[4] < state.revision ||
        (f[2] === o.ownId ? o.ownSession : o.peerSessionId(f[2])) !== f[3]
      )
        return;
      const offer = this.offeredTransfer;
      if (
        f[2] === o.ownId &&
        (!offer ||
          offer.token !== f[5] ||
          offer.revision !== f[4] ||
          o.elapsed > offer.deadline ||
          !o.synchronized)
      )
        return;
      o.adoptLeader(f[2], f[3], f[4], true);
    }
  }
  private revision(value: unknown): value is number {
    return (
      typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483646
    );
  }
  private text(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 128 &&
      !/[\x00-\x1f\x7f]/.test(value)
    );
  }
}
