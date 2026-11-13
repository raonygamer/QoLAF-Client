import type { IPCMessage } from '../ipc/ClientIPCCodec';
import type { RadioState } from './RadioState';

export type RadioRequestOutcome = 'pending' | 'accepted' | 'denied' | 'rejected' | 'expired';
interface RequestEntry {
  sender?: string;
  created: number;
  roomId: string;
  hostId: string;
  hostSession: string;
  session: string;
  outcome: RadioRequestOutcome | 'sent';
}
export interface RadioRequestOwner {
  readonly state: RadioState | null;
  readonly host: boolean;
  readonly online: boolean;
  readonly synchronized: boolean;
  readonly transferringLeadership: boolean;
  readonly elapsed: number;
  readonly ownId: string;
  readonly ownSession: string;
  readonly hostSession: string;
  readonly members: ReadonlyMap<string, { session: string; seen: number }>;
  peerSessionId(id: string): string | null;
  status(message: string): void;
  onTrackRequest(query: string, sender: string, requestId: string | null): boolean;
  onRequestResult(requestId: string, outcome: RadioRequestOutcome): void;
  queue(
    target: string,
    message: IPCMessage,
    key: string,
    kind: 'request' | 'requestResult',
  ): boolean;
}

/** Original bounded request ledger; retries never create a fresh request lifetime. */
export class RadioRequests {
  private outstanding = new Map<string, RequestEntry>();
  private received = new Map<string, RequestEntry>();
  private requestTimes = new Map<string, number>();
  private requestWindow: number[] = [];
  private nextRequest = 0;
  private nonce = 0;
  constructor(private owner: RadioRequestOwner) {}

  requestTrack(raw: string | null): boolean {
    const o = this.owner,
      state = o.state;
    if (!o.synchronized || !state) {
      o.status('Join a connected radio room first.');
      return false;
    }
    const query = (raw ?? '')
      .replace(/[\x00-\x1f\x7f]/g, ' ')
      .trim()
      .slice(0, 256);
    if (!query.length) return false;
    if (state.queue.length >= 10) {
      o.status('The radio queue is full (10 tracks).');
      return false;
    }
    if (o.host) return o.onTrackRequest(query, o.ownId, null);
    if (o.elapsed < this.nextRequest) {
      o.status('Please wait a few seconds before requesting another song.');
      return false;
    }
    if (this.outstanding.size >= 8) {
      o.status('Wait for the leader to review your pending requests.');
      return false;
    }
    const requestId = o.ownSession.slice(0, 80) + '-' + (++this.nonce).toString(16);
    if (
      !this.validId(requestId) ||
      !o.queue(
        state.hostId,
        {
          type: 'qipc3.radio.request',
          fields: [o.ownSession, state.roomId, o.hostSession, query, requestId],
        },
        'request:' + requestId,
        'request',
      )
    ) {
      o.status('Could not send the song request. Please try again.');
      return false;
    }
    this.outstanding.set(requestId, {
      created: o.elapsed,
      roomId: state.roomId,
      hostId: state.hostId,
      hostSession: o.hostSession,
      session: o.ownSession,
      outcome: 'sent',
    });
    this.nextRequest = o.elapsed + 10000;
    o.status("Song request sent. Waiting for the leader's approval.");
    return true;
  }

  respond(sender: string, requestId: string, outcome: RadioRequestOutcome): boolean {
    const o = this.owner,
      state = o.state,
      member = o.members.get(sender);
    if (
      !o.host ||
      !o.online ||
      !state ||
      !this.validId(requestId) ||
      !this.validOutcome(outcome) ||
      !member ||
      o.peerSessionId(sender) !== member.session
    )
      return false;
    const entry = this.received.get(sender + ':' + requestId);
    if (!entry) {
      if (outcome !== 'rejected') return false;
    } else if (
      entry.session !== member.session ||
      entry.roomId !== state.roomId ||
      entry.hostSession !== o.ownSession ||
      o.elapsed - entry.created >= 150000 ||
      (entry.outcome !== 'pending' && entry.outcome !== outcome)
    )
      return false;
    const queued = o.queue(
      sender,
      {
        type: 'qipc3.radio.requestResult',
        fields: [o.ownSession, state.roomId, member.session, requestId, outcome],
      },
      `requestResult:${sender}:${requestId}:${outcome}`,
      'requestResult',
    );
    if (queued && entry) entry.outcome = outcome;
    return queued;
  }

  isPending(sender: string, requestId: string): boolean {
    const o = this.owner,
      state = o.state,
      member = o.members.get(sender),
      entry = this.received.get(sender + ':' + requestId);
    return !!(
      o.host &&
      o.online &&
      state &&
      this.validId(requestId) &&
      member &&
      entry &&
      entry.outcome === 'pending' &&
      o.elapsed - member.seen <= 65000 &&
      o.peerSessionId(sender) === member.session &&
      entry.session === member.session &&
      entry.roomId === state.roomId &&
      entry.hostSession === o.ownSession &&
      o.elapsed - entry.created < 150000
    );
  }

  receive(message: IPCMessage, sender: string): void {
    const o = this.owner,
      state = o.state,
      f = message.fields;
    if (
      !o.online ||
      !state ||
      f.length !== 5 ||
      typeof f[0] !== 'string' ||
      o.peerSessionId(sender) !== f[0]
    )
      return;
    if (message.type === 'qipc3.radio.requestResult') {
      if (
        o.host ||
        sender !== state.hostId ||
        f[0] !== o.hostSession ||
        f[1] !== state.roomId ||
        f[2] !== o.ownSession ||
        !this.validId(f[3]) ||
        !this.validOutcome(f[4])
      )
        return;
      const entry = this.outstanding.get(f[3]);
      if (
        !entry ||
        entry.hostId !== sender ||
        entry.hostSession !== o.hostSession ||
        entry.session !== o.ownSession ||
        entry.roomId !== state.roomId ||
        o.elapsed - entry.created >= 150000
      )
        return;
      if (f[4] === 'pending' && entry.outcome === 'pending') return;
      if (f[4] === 'pending') entry.outcome = f[4];
      else this.outstanding.delete(f[3]);
      this.notify(f[3], f[4]);
      return;
    }
    if (
      message.type !== 'qipc3.radio.request' ||
      !o.host ||
      o.transferringLeadership ||
      f[1] !== state.roomId ||
      f[2] !== o.ownSession ||
      o.members.get(sender)?.session !== f[0] ||
      typeof f[3] !== 'string' ||
      !f[3].length ||
      f[3].length > 256 ||
      /[\x00-\x1f\x7f]/.test(f[3]) ||
      !this.validId(f[4])
    )
      return;
    const key = sender + ':' + f[4],
      prior = this.received.get(key);
    if (prior && prior.session === f[0]) {
      this.respond(sender, f[4], prior.outcome as RadioRequestOutcome);
      return;
    }
    if (this.received.size >= 64 || state.queue.length >= 10 || !this.allowRequest(sender)) {
      this.respond(sender, f[4], 'rejected');
      return;
    }
    this.received.set(key, {
      sender,
      hostId: o.ownId,
      session: f[0],
      roomId: state.roomId,
      hostSession: o.ownSession,
      created: o.elapsed,
      outcome: 'pending',
    });
    let admitted = false;
    try {
      admitted = o.onTrackRequest(f[3], sender, f[4]);
    } catch {
      /* A failing moderation callback rejects this request only. */
    }
    if (!admitted) this.received.delete(key);
    this.respond(sender, f[4], admitted ? 'pending' : 'rejected');
  }

  /** Only a request with no received Pending result may be abandoned on send failure. */
  abandon(requestId: string): void {
    const entry = this.outstanding.get(requestId);
    if (!entry || entry.outcome !== 'sent') return;
    this.outstanding.delete(requestId);
    this.notify(requestId, 'rejected');
  }
  hasOutstanding(requestId: string): boolean {
    return this.outstanding.has(requestId);
  }
  invalidateMember(sender: string): void {
    for (const entry of this.received.values())
      if (entry.sender === sender && entry.outcome === 'pending') entry.outcome = 'expired';
  }
  expire(): void {
    const expired: string[] = [];
    for (const [id, entry] of this.outstanding)
      if (this.owner.elapsed - entry.created >= 150000) {
        this.outstanding.delete(id);
        expired.push(id);
      }
    for (const [id, entry] of this.received)
      if (this.owner.elapsed - entry.created >= 150000) this.received.delete(id);
    for (const id of expired) this.notify(id, 'expired');
  }
  clear(): void {
    this.outstanding.clear();
    this.received.clear();
    this.nextRequest = 0;
  }

  /** Room departure resets admission limits; a session refresh only clears requests. */
  clearRoom(): void {
    this.clear();
    this.requestTimes.clear();
    this.requestWindow = [];
  }

  expireAdmissionTimes(): void {
    for (const [sender, time] of this.requestTimes)
      if (this.owner.elapsed - time > 65000) this.requestTimes.delete(sender);
  }

  private allowRequest(sender: string): boolean {
    const elapsed = this.owner.elapsed,
      last = this.requestTimes.get(sender);
    if (last !== undefined && elapsed - last < 10000) return false;
    while (this.requestWindow.length && elapsed - this.requestWindow[0] >= 60000)
      this.requestWindow.shift();
    if (
      this.requestWindow.length >= 6 ||
      (this.requestWindow.length > 0 &&
        elapsed - this.requestWindow[this.requestWindow.length - 1] < 2000)
    )
      return false;
    this.requestTimes.set(sender, elapsed);
    this.requestWindow.push(elapsed);
    return true;
  }
  private notify(id: string, outcome: RadioRequestOutcome): void {
    const status = {
      pending: "Song request pending the leader's approval.",
      accepted: 'The leader accepted your song request.',
      denied: 'The leader declined your song request.',
      expired: 'Your song request expired. You can request it again.',
      rejected: 'The leader could not take your song request. Please try again later.',
    };
    try {
      this.owner.onRequestResult(id, outcome);
    } catch {
      /* Result observers cannot prevent ledger cleanup. */
    }
    this.owner.status(status[outcome]);
  }
  private validId(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  }
  private validOutcome(value: unknown): value is RadioRequestOutcome {
    return (
      typeof value === 'string' &&
      ['pending', 'accepted', 'denied', 'rejected', 'expired'].includes(value)
    );
  }
}
