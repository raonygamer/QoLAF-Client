import type { IPCMessage } from '../ipc/ClientIPCCodec';
import type { RadioRoomTransport } from './RadioRooms';
import type { RadioService } from './RadioService';
import { selectRadioInviteTargets, type RadioInvitePeer } from './RadioInviteTargets';

export interface RadioInviteTransport extends RadioRoomTransport {
  readonly onlinePlayers: RadioInvitePeer[];
  findPeer(query: string): RadioInvitePeer | null;
}
export interface RadioInviteEnvironment {
  now(): number;
  clock(): number;
  after(callback: () => void, ms: number): () => void;
  currentTransport(): RadioInviteTransport | null;
  existingRadio(): RadioService | null;
  getRadio(): RadioService;
  currentGame(): object | null;
  inCurrentRoom(game: object | null, id: string): boolean;
  /** Render the message using source radio pulse coloring and escape text before markup. */
  note(text: string): void;
}
interface Invite {
  id: string;
  name: string;
  session: string;
  own: string;
  token: string;
  room: string;
  group: string;
  until: number;
  expires: number;
  accepting?: boolean;
}
interface OutgoingInvite extends Invite {
  queuedAt: number;
  quiet: boolean;
  game: object | null;
  accepted?: boolean;
}
const types = ['invite', 'inviteReply', 'inviteJoin'].map((kind) => 'qipc3.radio.' + kind);

/** Authentication-owned invitation handshake; receiving never creates the Radio service. */
export class RadioInvites {
  private pending: Invite | null = null;
  private outgoing = new Map<string, OutgoingInvite>();
  private seen = new Map<string, number>();
  private cancelExpiry: (() => void) | null = null;
  private nonce = 0;
  private lastNotice = -10000;
  private queue: OutgoingInvite[] = [];
  private sending: OutgoingInvite | null = null;
  private cancelPump: (() => void) | null = null;
  private closed = false;
  constructor(
    private ipc: RadioInviteTransport,
    private environment: RadioInviteEnvironment,
  ) {
    for (const type of types) ipc.addMessageHandler(type, this.receive);
    ipc.addDisposeHandler(this.dispose);
  }
  private live(): boolean {
    return (
      !this.closed &&
      this.ipc === this.environment.currentTransport() &&
      this.ipc.connected &&
      !this.ipc.paused
    );
  }
  private note(message: string): void {
    this.environment.note(message);
  }
  private prune(): void {
    const now = this.environment.now();
    for (const [token, record] of this.outgoing)
      if (now >= record.until) this.outgoing.delete(token);
    for (const [token, seen] of this.seen) if (now - seen >= 360000) this.seen.delete(token);
  }
  invite(target: string): void {
    const e = this.environment,
      radio = e.existingRadio();
    if (!this.live() || !Number.isFinite(e.clock())) {
      this.note('Wait until IPC and the game clock are connected.');
      return;
    }
    if (!radio?.rooms.host || !radio.rooms.synchronized || radio.rooms.transferringLeadership) {
      this.note('Only the Radio leader can invite players.');
      return;
    }
    const selected = selectRadioInviteTargets(
      target,
      this.ipc.onlinePlayers,
      (query) => this.ipc.findPeer(query),
      (id) => e.inCurrentRoom(e.currentGame(), id),
    );
    if (!selected) {
      this.note(
        'Usage: /invitetoradio <@Player|roompeers|allpeers|[@a,@b,@c]>. Every target must be an online IPC peer.',
      );
      return;
    }
    this.prune();
    const excluded = new Set(radio.rooms.peers.map((p) => p.id));
    const own = this.ipc.ownLoginInfo();
    if (own) excluded.add(own.id);
    for (const record of this.outgoing.values()) excluded.add(record.id);
    const eligible = selected.peers.filter((peer) => {
      if (excluded.has(peer.id)) return false;
      excluded.add(peer.id);
      return true;
    });
    if (!eligible.length) {
      this.note(
        'No new IPC peers to invite; matching players are already invited or in your Radio group.',
      );
      return;
    }
    if (this.outgoing.size + eligible.length > 512) {
      this.note('Wait for your pending Radio invites to expire or receive a reply.');
      return;
    }
    const room = radio.rooms.state!;
    for (const peer of eligible) {
      const token = this.ipc.sessionId + '-ri-' + (++this.nonce).toString(16);
      const record: OutgoingInvite = {
        id: peer.id,
        name: peer.name,
        session: this.ipc.peerSessionId(peer.id)!,
        own: this.ipc.sessionId!,
        token,
        room: room.roomId,
        group: room.name,
        until: e.now() + 300000,
        expires: 0,
        queuedAt: e.now(),
        quiet: selected.bulk,
        game: selected.roomScoped ? e.currentGame() : null,
      };
      this.outgoing.set(token, record);
      this.queue.push(record);
    }
    if (selected.bulk)
      this.note(
        'Queued Radio invitations for ' +
          eligible.length +
          ' players (3 minutes to accept once sent).',
      );
    this.pump();
  }
  private canInvite(record: OutgoingInvite): boolean {
    const e = this.environment,
      radio = e.existingRadio();
    return (
      this.live() &&
      this.outgoing.get(record.token) === record &&
      this.ipc.sessionId === record.own &&
      e.now() - record.queuedAt < 300000 &&
      this.ipc.peerSessionId(record.id) === record.session &&
      !!radio?.rooms.host &&
      radio.rooms.synchronized &&
      !radio.rooms.transferringLeadership &&
      radio.rooms.state?.roomId === record.room &&
      Number.isFinite(e.clock()) &&
      (record.game === null || e.inCurrentRoom(record.game, record.id)) &&
      !radio.rooms.peers.some((p) => p.id === record.id)
    );
  }
  private pump(): void {
    if (this.sending || this.cancelPump) return;
    let record: OutgoingInvite | undefined;
    while (this.queue.length) {
      record = this.queue.shift()!;
      if (this.canInvite(record)) break;
      this.outgoing.delete(record.token);
      record = undefined;
    }
    if (!record) return;
    const selected = record;
    this.sending = selected;
    this.ipc.send(
      selected.id,
      { type: 'qipc3.radio.invite', fields: [] },
      {
        beforeSend: () => {
          if (this.sending !== selected || !this.canInvite(selected)) return null;
          selected.until = this.environment.now() + 180000;
          selected.expires = this.environment.clock() + 180000;
          return {
            type: 'qipc3.radio.invite',
            fields: [
              selected.own,
              selected.session,
              selected.token,
              selected.room,
              selected.group,
              selected.expires,
            ],
          };
        },
        onSent: () => this.finish(selected, true, ''),
        onError: (reason) => this.finish(selected, false, reason),
      },
    );
  }
  private finish(record: OutgoingInvite, sent: boolean, reason: string): void {
    if (this.sending !== record) return;
    this.sending = null;
    if (!sent && reason.includes('queue is full') && this.canInvite(record))
      this.queue.unshift(record);
    else if (!sent) {
      this.outgoing.delete(record.token);
      this.note("Couldn't send the Radio invite to " + record.name + '.');
    } else if (!record.quiet)
      this.note('Invited ' + record.name + ' to Radio group ' + record.group + ' (3 minutes).');
    if (this.queue.length)
      this.cancelPump = this.environment.after(() => {
        this.cancelPump = null;
        this.pump();
      }, 200);
  }
  private receive = (message: IPCMessage, sender: string, name: string): void => {
    const f = message.fields,
      e = this.environment;
    if (
      !this.live() ||
      f.length < 5 ||
      f[0] !== this.ipc.peerSessionId(sender) ||
      f[1] !== this.ipc.sessionId ||
      !this.id(f[2]) ||
      !this.id(f[3])
    )
      return;
    this.prune();
    if (message.type === 'qipc3.radio.inviteReply') {
      this.receiveReply(message, sender);
      return;
    }
    if (message.type === 'qipc3.radio.inviteJoin') {
      this.receiveJoin(message, sender);
      return;
    }
    if (
      message.type !== 'qipc3.radio.invite' ||
      f.length !== 6 ||
      typeof f[4] !== 'string' ||
      !f[4].length ||
      f[4].length > 48 ||
      /[\x00-\x1f\x7f]/.test(f[4]) ||
      typeof f[5] !== 'number' ||
      !Number.isFinite(e.clock())
    )
      return;
    const remaining = f[5] - e.clock(),
      token = sender + ':' + f[2];
    if (
      !Number.isFinite(remaining) ||
      remaining <= 0 ||
      remaining > 185000 ||
      this.seen.has(token) ||
      this.seen.size >= 256 ||
      this.pending ||
      e.now() - this.lastNotice < 3000
    )
      return;
    this.seen.set(token, e.now());
    this.lastNotice = e.now();
    this.pending = {
      id: sender,
      name,
      session: String(f[0]),
      own: this.ipc.sessionId!,
      token: f[2],
      room: f[3],
      group: f[4],
      expires: f[5],
      until: e.now() + Math.min(180000, remaining),
      accepting: false,
    };
    this.cancelExpiry = e.after(() => this.expire(), Math.min(180000, remaining));
    this.note(
      name +
        ' invited you to Radio group ' +
        this.pending.group +
        '. /radioinvite accept|deny (3 minutes)',
    );
  };
  private expire(): void {
    const invite = this.pending;
    if (!invite) return;
    this.clearPending();
    this.reply(invite, 'expired');
    this.note('Radio invite from ' + invite.name + ' expired.');
  }
  respond(action: string): void {
    action = (action ?? '').toLowerCase().trim();
    if (!['accept', 'deny', 'decline'].includes(action)) {
      this.note('Usage: /radioinvite <accept|deny>');
      return;
    }
    const invite = this.pending;
    if (!invite) {
      this.note('You have no pending Radio invite.');
      return;
    }
    if (this.environment.now() >= invite.until) {
      this.expire();
      return;
    }
    if (
      !this.live() ||
      invite.own !== this.ipc.sessionId ||
      this.ipc.peerSessionId(invite.id) !== invite.session
    ) {
      this.clearPending();
      this.note('That Radio invite is no longer available.');
      return;
    }
    if (action !== 'accept') {
      this.clearPending();
      this.reply(invite, 'deny');
      this.note('Declined the Radio invite from ' + invite.name + '.');
      return;
    }
    if (invite.accepting) {
      this.note('Waiting for the leader to confirm your Radio invite.');
      return;
    }
    const radio = this.environment.getRadio();
    radio.open();
    if (!radio.available) {
      this.note('Open /radio and finish setup, then accept the invite again.');
      return;
    }
    invite.accepting = true;
    this.reply(invite, 'accept');
  }
  private reply(invite: Invite, outcome: string): void {
    if (
      !this.live() ||
      this.ipc.sessionId !== invite.own ||
      this.ipc.peerSessionId(invite.id) !== invite.session
    )
      return;
    this.ipc.send(
      invite.id,
      {
        type: 'qipc3.radio.inviteReply',
        fields: [this.ipc.sessionId, invite.session, invite.token, invite.room, outcome],
      },
      {
        onError: () => {
          if (this.pending === invite) {
            invite.accepting = false;
            this.note("Couldn't answer the Radio invite. Try again.");
          }
        },
      },
    );
  }
  private receiveReply(message: IPCMessage, sender: string): void {
    const f = message.fields;
    if (f.length !== 5 || typeof f[4] !== 'string') return;
    const token = String(f[2]),
      record = this.outgoing.get(token);
    if (
      !record ||
      record.expires <= 0 ||
      record.id !== sender ||
      record.session !== f[0] ||
      record.own !== this.ipc.sessionId ||
      record.room !== f[3] ||
      this.environment.now() >= record.until
    )
      return;
    if (f[4] === 'deny' || f[4] === 'expired') {
      this.outgoing.delete(token);
      this.note(
        record.name +
          (f[4] === 'deny'
            ? ' declined your Radio invite.'
            : " didn't accept your Radio invite in time."),
      );
      return;
    }
    if (f[4] !== 'accept' || record.accepted) return;
    const radio = this.environment.existingRadio();
    if (
      !radio?.rooms.host ||
      radio.rooms.state?.roomId !== record.room ||
      radio.rooms.invitationKey === null
    )
      return;
    record.accepted = true;
    this.ipc.send(
      sender,
      { type: 'qipc3.radio.inviteJoin', fields: [] },
      {
        onSent: () => this.note(record.name + ' accepted your Radio invite.'),
        onError: () => {
          record.accepted = false;
        },
        beforeSend: () => {
          const service = this.environment.existingRadio();
          if (
            !this.live() ||
            record.own !== this.ipc.sessionId ||
            this.environment.now() >= record.until ||
            !service?.rooms.host ||
            service.rooms.state?.roomId !== record.room ||
            service.rooms.invitationKey === null
          )
            return null;
          return {
            type: 'qipc3.radio.inviteJoin',
            fields: [
              this.ipc.sessionId!,
              record.session,
              token,
              record.room,
              record.group,
              record.expires,
              service.rooms.invitationKey,
            ],
          };
        },
      },
    );
  }
  private receiveJoin(message: IPCMessage, sender: string): void {
    const f = message.fields,
      invite = this.pending;
    if (
      f.length !== 7 ||
      !invite?.accepting ||
      invite.id !== sender ||
      invite.session !== f[0] ||
      invite.token !== f[2] ||
      invite.room !== f[3] ||
      invite.group !== f[4] ||
      invite.expires !== f[5] ||
      this.environment.now() >= invite.until ||
      typeof f[6] !== 'string'
    )
      return;
    const radio = this.environment.existingRadio();
    if (!radio?.available) return;
    this.clearPending();
    this.note(
      radio.rooms.joinInvitation(sender, invite.session, invite.room, invite.group, f[6])
        ? 'Joining Radio group ' + invite.group + '.'
        : 'That Radio invite is no longer available.',
    );
  }
  private clearPending(): void {
    this.cancelExpiry?.();
    this.cancelExpiry = null;
    this.pending = null;
  }
  private id(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  }
  dispose = (): void => {
    if (this.closed) return;
    this.clearPending();
    this.cancelPump?.();
    this.cancelPump = null;
    this.queue = [];
    this.sending = null;
    for (const type of types) this.ipc.removeMessageHandler(type, this.receive);
    this.ipc.removeDisposeHandler(this.dispose);
    this.outgoing.clear();
    this.seen.clear();
    this.closed = true;
  };
}
