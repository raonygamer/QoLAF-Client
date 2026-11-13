import type { IPCMessage } from '../ipc/ClientIPCCodec';
import type { RadioPeer, RadioState } from './RadioState';

export interface RadioMember {
  seen: number;
  session: string;
  name: string;
  dj: boolean;
  authority: number;
  lastControl: number;
  joinAttempt: string;
}
export interface RadioMembershipOwner {
  readonly state: RadioState | null;
  readonly online: boolean;
  readonly closed: boolean;
  readonly host: boolean;
  readonly synchronized: boolean;
  readonly transferringLeadership: boolean;
  readonly ownId: string;
  readonly ownSession: string;
  readonly elapsed: number;
  readonly passwordProtected: boolean;
  peerSessionId(id: string): string | null;
  verifyPassword(sender: string, session: string, proof: string): boolean;
  invalidateRequests(sender: string): void;
  removeReadyPeer(sender: string): void;
  finishReadiness(): void;
  publish(): void;
  advertiseSoon(): void;
  sendSnapshot(sender: string): void;
  status(message: string): void;
  queue(
    target: string,
    message: IPCMessage,
    key: string,
    bound: boolean,
    kind: 'kick' | 'joinResult',
  ): boolean;
}

/** Leader membership and role lifecycle from RadioRooms. */
export class RadioMembership {
  readonly members = new Map<string, RadioMember>();
  private kicked = new Map<string, { session: string; attempt: string; seen: number }>();
  private replyTimes = new Map<string, number>();
  private roleNonce = 0;
  constructor(private owner: RadioMembershipOwner) {}

  firstSuccessor(): { id: string; session: string; authority: number } | null {
    let first: { id: string; session: string; authority: number } | null = null;
    for (const [id, member] of this.members) {
      if (!this.isDJ(id)) continue;
      if (
        !first ||
        member.authority < first.authority ||
        (member.authority === first.authority && id < first.id)
      )
        first = { id, session: member.session, authority: member.authority };
    }
    return first;
  }

  /** Rebuild roles from the previous authenticated roster during leader adoption. */
  adoptLeader(
    entries: readonly RadioPeer[],
    oldHost: string,
    newHost: string,
    keepPrevious: boolean,
  ): RadioPeer[] {
    const o = this.owner;
    this.members.clear();
    this.roleNonce = 0;
    for (const entry of entries) this.roleNonce = Math.max(this.roleNonce, entry.authority);
    const roster: RadioPeer[] = [];
    for (const entry of entries) {
      if (entry.id === oldHost && !keepPrevious) continue;
      if (entry.id !== o.ownId && o.peerSessionId(entry.id) !== entry.session) continue;
      const role = entry.id === newHost ? 'host' : entry.id === oldHost ? 'dj' : entry.role;
      const authority = entry.id === oldHost ? ++this.roleNonce : entry.authority;
      roster.push({ ...entry, role, authority });
      if (entry.id !== newHost && newHost === o.ownId)
        this.members.set(entry.id, {
          session: entry.session,
          name: entry.name,
          seen: o.elapsed,
          dj: role === 'dj',
          authority,
          lastControl: 0,
          joinAttempt: '',
        });
    }
    return roster;
  }

  isDJ(id: string): boolean {
    const o = this.owner,
      member = this.members.get(id);
    return !!(
      o.host &&
      member?.dj &&
      o.elapsed - member.seen <= 65000 &&
      o.peerSessionId(id) === member.session
    );
  }

  setDJ(id: string, session: string, enabled: boolean): void {
    const o = this.owner,
      member = this.members.get(id);
    if (
      !o.host ||
      !o.synchronized ||
      o.transferringLeadership ||
      id === o.ownId ||
      !member ||
      member.session !== session ||
      o.peerSessionId(id) !== session ||
      o.elapsed - member.seen > 65000 ||
      member.dj === enabled
    )
      return;
    member.dj = enabled;
    member.authority = ++this.roleNonce;
    o.publish();
  }

  kickPeer(id: string, session: string): boolean {
    const o = this.owner,
      member = this.members.get(id),
      state = o.state;
    if (
      !state ||
      !o.host ||
      !o.synchronized ||
      o.transferringLeadership ||
      id === o.ownId ||
      !member ||
      member.session !== session ||
      o.peerSessionId(id) !== session
    )
      return false;
    this.kicked.set(id, { session, attempt: member.joinAttempt, seen: o.elapsed });
    o.invalidateRequests(id);
    this.members.delete(id);
    o.removeReadyPeer(id);
    o.queue(
      id,
      { type: 'qipc3.radio.kick', fields: [o.ownSession, state.roomId, session] },
      'kick:' + id,
      true,
      'kick',
    );
    o.publish();
    o.advertiseSoon();
    o.status('Removed ' + member.name + ' from the Radio group.');
    return true;
  }

  receive(message: IPCMessage, sender: string, name: string): void {
    const o = this.owner,
      state = o.state,
      f = message.fields;
    if (
      o.closed ||
      !o.online ||
      !o.host ||
      !state ||
      o.transferringLeadership ||
      f.length < 3 ||
      typeof f[0] !== 'string' ||
      o.peerSessionId(sender) !== f[0] ||
      f[1] !== state.roomId ||
      f[2] !== o.ownSession
    )
      return;
    if (message.type === 'qipc3.radio.leave' && f.length === 3) {
      if (this.members.get(sender)?.session !== f[0]) return;
      o.invalidateRequests(sender);
      this.members.delete(sender);
      o.removeReadyPeer(sender);
      o.publish();
      o.advertiseSoon();
      o.finishReadiness();
      return;
    }
    if (
      message.type !== 'qipc3.radio.join' ||
      (f.length !== 5 && f.length !== 7) ||
      typeof f[3] !== 'number' ||
      !Number.isInteger(f[3]) ||
      f[3] < -1 ||
      f[3] > 2147483647 ||
      typeof f[4] !== 'boolean'
    )
      return;
    if (
      f.length === 7 &&
      (typeof f[5] !== 'string' ||
        f[5].length > 64 ||
        typeof f[6] !== 'string' ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(f[6]))
    )
      return;
    const kicked = this.kicked.get(sender);
    if (
      kicked &&
      o.elapsed - kicked.seen < 180000 &&
      kicked.session === f[0] &&
      (f.length !== 7 || kicked.attempt === f[6])
    ) {
      this.reject(sender, message, 'kicked');
      return;
    }
    if (
      o.passwordProtected &&
      (f.length !== 7 || !o.verifyPassword(sender, f[0], f[5] as string))
    ) {
      this.reject(sender, message, 'password');
      return;
    }
    const previous = this.members.get(sender);
    if (!previous && this.members.size >= 8) {
      this.reject(sender, message, 'full');
      return;
    }
    const fresh = !previous || previous.session !== f[0];
    const joinAttempt = f.length === 7 ? (f[6] as string) : '';
    if (fresh) {
      o.invalidateRequests(sender);
      this.members.set(sender, {
        seen: o.elapsed,
        session: f[0],
        name: this.clean(name) || this.clean(sender),
        dj: false,
        authority: ++this.roleNonce,
        lastControl: 0,
        joinAttempt,
      });
      o.publish();
      o.advertiseSoon();
    } else {
      previous.seen = o.elapsed;
      previous.joinAttempt = joinAttempt;
    }
    if ((fresh || f[4] || f[3] < state.revision) && this.mayReply('join:' + sender, 10000))
      o.sendSnapshot(sender);
  }

  expire(): void {
    const o = this.owner;
    for (const [id, kicked] of this.kicked)
      if (o.elapsed - kicked.seen >= 180000) this.kicked.delete(id);
    let removed = false;
    for (const [id, member] of this.members) {
      if (o.elapsed - member.seen > 65000 || o.peerSessionId(id) !== member.session) {
        o.invalidateRequests(id);
        this.members.delete(id);
        removed = true;
      }
    }
    if (removed) {
      o.publish();
      o.advertiseSoon();
    }
    for (const [id, seen] of this.replyTimes)
      if (o.elapsed - seen > 65000) this.replyTimes.delete(id);
  }

  /** Clear room-owned roles; reply limits belong to the transport lifetime. */
  clear(): void {
    this.members.clear();
    this.kicked.clear();
  }

  private reject(sender: string, message: IPCMessage, reason: string): void {
    if (message.fields.length !== 7 || !this.mayReply('joinRejected:' + sender, 1000)) return;
    const o = this.owner;
    o.queue(
      sender,
      {
        type: 'qipc3.radio.joinResult',
        fields: [o.ownSession, o.state!.roomId, message.fields[0], message.fields[6], reason],
      },
      'joinResult:' + sender,
      true,
      'joinResult',
    );
  }

  private mayReply(key: string, interval: number): boolean {
    const previous = this.replyTimes.get(key);
    if (previous !== undefined && this.owner.elapsed - previous < interval) return false;
    this.replyTimes.set(key, this.owner.elapsed);
    return true;
  }

  private clean(text: string): string {
    return text
      .replace(/[\x00-\x1f\x7f]/g, ' ')
      .trim()
      .slice(0, 100);
  }
}
