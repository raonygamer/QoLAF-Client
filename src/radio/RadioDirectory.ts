import type { IPCMessage } from '../ipc/ClientIPCCodec';
import type { RadioState } from './RadioState';

export interface RadioRoomListing {
  hostId: string;
  hostName: string;
  roomId: string;
  name: string;
  count: number;
  passwordProtected: boolean;
}
export interface RadioDirectoryEntry extends RadioRoomListing {
  session: string;
  seen: number;
}
export interface RadioDirectoryOwner {
  readonly state: RadioState | null;
  readonly host: boolean;
  readonly online: boolean;
  readonly closed: boolean;
  readonly elapsed: number;
  readonly ownSession: string;
  readonly hostSession: string;
  readonly memberCount: number;
  readonly passwordProtected: boolean;
  readonly leadershipProof: IPCMessage | null;
  peerSessionId(id: string): string | null;
  changed(): void;
  clearRoom(reason: string): void;
  queue(
    target: string | null,
    message: IPCMessage,
    key: string,
    bound?: boolean,
    kind?: 'takeover',
  ): boolean;
}

/** Authenticated, bounded room directory and original discovery/advertisement timers. */
export class RadioDirectory {
  private entries = new Map<string, RadioDirectoryEntry>();
  private replies = new Map<string, number>();
  private nextDiscovery = 0;
  private nextAdvertise = 0;
  constructor(private owner: RadioDirectoryOwner) {}

  get rooms(): RadioRoomListing[] {
    const result: RadioRoomListing[] = [];
    for (const entry of this.entries.values()) {
      if (this.owner.elapsed - entry.seen > 65000) continue;
      const { hostId, hostName, roomId, name, count, passwordProtected } = entry;
      result.push({ hostId, hostName, roomId, name, count, passwordProtected });
    }
    return result;
  }

  get(hostId: string): RadioDirectoryEntry | undefined {
    const entry = this.entries.get(hostId);
    return entry ? { ...entry } : undefined;
  }

  /** Used by invitation acceptance and leader adoption, with their validated identities. */
  set(entry: RadioDirectoryEntry): void {
    this.entries.set(entry.hostId, { ...entry });
  }

  remove(hostId: string): void {
    this.entries.delete(hostId);
  }

  refresh(): void {
    const o = this.owner;
    if (!o.online || o.elapsed < this.nextDiscovery) return;
    this.nextDiscovery = o.elapsed + 20000;
    o.queue(null, { type: 'qipc3.radio.discover', fields: [o.ownSession] }, 'discover');
  }

  discoverySoon(): void {
    this.nextDiscovery = this.owner.elapsed;
  }

  advertiseSoon(): void {
    this.nextAdvertise = this.owner.elapsed;
  }

  advertiseIfDue(): void {
    if (this.owner.elapsed >= this.nextAdvertise) this.advertise();
  }

  advertise(target: string | null = null): void {
    const o = this.owner,
      state = o.state;
    if (!o.host || !state) return;
    if (o.leadershipProof) o.queue(null, o.leadershipProof, 'takeover', true, 'takeover');
    o.queue(
      target,
      {
        type: 'qipc3.radio.advertise',
        fields: [o.ownSession, state.roomId, state.name, o.memberCount + 1, o.passwordProtected],
      },
      'advertise:' + target,
      true,
    );
    if (target === null) this.nextAdvertise = o.elapsed + 20000;
  }

  receive(message: IPCMessage, sender: string, name: string): void {
    const o = this.owner,
      f = message.fields;
    if (o.closed || !o.online || typeof f[0] !== 'string' || o.peerSessionId(sender) !== f[0])
      return;
    if (message.type === 'qipc3.radio.discover') {
      const last = this.replies.get(sender);
      if (f.length === 1 && o.host && (last === undefined || o.elapsed - last >= 10000)) {
        this.replies.set(sender, o.elapsed);
        this.advertise(sender);
      }
      return;
    }
    if (message.type === 'qipc3.radio.close') {
      if (f.length !== 2 || typeof f[1] !== 'string') return;
      if (this.entries.get(sender)?.roomId === f[1]) {
        this.entries.delete(sender);
        o.changed();
      }
      if (
        o.state &&
        !o.host &&
        o.state.hostId === sender &&
        o.hostSession === f[0] &&
        o.state.roomId === f[1]
      )
        o.clearRoom('The leader closed the radio room.');
      return;
    }
    if (
      message.type !== 'qipc3.radio.advertise' ||
      (f.length !== 4 && f.length !== 5) ||
      (f.length === 5 && typeof f[4] !== 'boolean') ||
      typeof f[1] !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(f[1]) ||
      typeof f[2] !== 'string' ||
      f[2].length === 0 ||
      f[2].length > 48 ||
      /[\x00-\x1f\x7f]/.test(f[2]) ||
      typeof f[3] !== 'number' ||
      !Number.isInteger(f[3]) ||
      f[3] < 1 ||
      f[3] > 9
    )
      return;
    if (!this.entries.has(sender) && this.entries.size >= 64) return;
    this.entries.set(sender, {
      hostId: sender,
      hostName: name,
      roomId: f[1],
      name: f[2],
      count: f[3],
      session: f[0],
      seen: o.elapsed,
      passwordProtected: f.length === 5 && f[4] === true,
    });
    o.changed();
  }

  expire(): void {
    const o = this.owner;
    for (const [id, entry] of this.entries)
      if (o.elapsed - entry.seen > 65000 || o.peerSessionId(id) !== entry.session)
        this.entries.delete(id);
    for (const [id, seen] of this.replies) if (o.elapsed - seen > 65000) this.replies.delete(id);
  }

  /** Transport reattachment clears listings, preserving original pacing deadlines. */
  clear(): void {
    this.entries.clear();
  }
}
