import type {} from '../game/InitialWorld';
import {
  GameScene,
  JoinRoomLocator,
  MessageLog,
  type Connection,
  type Room,
} from '../game/Bindings';
import { gameRecoveryActive } from '../service/GameRecovery';
import { escapeRoomControlText } from './RoomControlIdentity';
import { prepareRoomControlReply } from './RoomControlReplies';
import { roomInviteWindow, type RoomInviteRequest } from './RoomControlProtocol';

export type JoinRoomInvitation = (
  game: GameScene,
  senderId: string,
  request: RoomInviteRequest,
) => boolean;

interface PendingInvite {
  request: RoomInviteRequest;
  senderId: string;
  senderName: string;
  expiresAt: number;
  sourceRoom: Room;
  sourceService: Connection | null;
  decline: (() => void) | null;
}

/** One scene-owned invitation; only detached receipts may survive scene disposal. */
export class RoomInvitations {
  private pending: PendingInvite | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;

  constructor(
    private readonly game: GameScene,
    private readonly join: JoinRoomInvitation,
  ) {}

  private current(): boolean {
    return (
      !this.disposed &&
      GameScene.instance === this.game &&
      !this.game.get_isLeaving() &&
      this.game.get_me() !== null
    );
  }

  private note(text: string): void {
    MessageLog.write(`<font color='#ffcc33'>[Room invite] ${text}</font>`);
  }

  receive(
    request: RoomInviteRequest,
    senderId: string,
    senderName: string,
    systemName: string,
  ): void {
    if (!this.current() || !this.game.clock) return;
    const remaining = Math.trunc(
      Math.min(
        roomInviteWindow,
        (request.sentAt + roomInviteWindow / 1000 - this.game.clock.getServerTime() / 1000) * 1000,
      ),
    );
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    this.clear(true);
    const pending: PendingInvite = {
      request: { ...request, destination: { ...request.destination } },
      senderId,
      senderName,
      expiresAt: performance.now() + remaining,
      sourceRoom: this.game.room,
      sourceService: this.game.serviceConnection,
      decline: prepareRoomControlReply(this.game, senderId, request.nonce, {
        requestType: request.type,
        result: 'declined',
      }),
    };
    this.pending = pending;
    this.timer = setTimeout(() => {
      if (!this.current() || this.pending !== pending) return;
      this.clear(true);
      this.note(`Invite from ${escapeRoomControlText(senderName)} expired.`);
    }, remaining);
    const seconds = Math.max(1, Math.ceil(remaining / 1000));
    const duration = seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;
    const mode = request.destination.systemType === 'friendly' ? 'PvE' : 'PvP';
    this.note(
      `${escapeRoomControlText(senderName)} invited you to ${escapeRoomControlText(systemName)} (${mode}). /roominvite accept|deny (${duration})`,
    );
  }

  respond(argument: string): void {
    if (!this.current()) return;
    const action = argument.trim().toLowerCase();
    if (action !== 'accept' && action !== 'deny') {
      MessageLog.write('Usage: /roominvite <accept|deny>', 'error');
      return;
    }
    const pending = this.pending;
    if (!pending) {
      this.note('No pending room invite.');
      return;
    }
    if (performance.now() >= pending.expiresAt) {
      this.clear(true);
      this.note(`Invite from ${escapeRoomControlText(pending.senderName)} expired.`);
      return;
    }
    if (action === 'deny') {
      this.clear(true);
      this.note(`Declined ${escapeRoomControlText(pending.senderName)}'s invite.`);
      return;
    }
    const manager = JoinRoomLocator.getService();
    if (
      pending.sourceRoom !== this.game.room ||
      pending.sourceService !== this.game.serviceConnection ||
      this.game.noAutoReconnect ||
      gameRecoveryActive(manager) ||
      !this.game.get_connected() ||
      !this.game.serviceConnection?.get_connected() ||
      !this.game.get_initialWorldIsRevealed() ||
      this.game.get_me()?.get_isWarpJumping()
    ) {
      this.clear(true);
      MessageLog.write('Your connection changed. Ask for a new invite.', 'error');
      return;
    }
    if (!manager) {
      MessageLog.write('Room joining is unavailable.', 'error');
      return;
    }
    const accepted = prepareRoomControlReply(this.game, pending.senderId, pending.request.nonce, {
      requestType: pending.request.type,
      result: 'accepted',
    });
    const decline = pending.decline;
    pending.decline = null;
    let started = false;
    try {
      started = this.join(this.game, pending.senderId, pending.request);
    } finally {
      if (this.pending === pending) pending.decline = decline;
    }
    if (!started) return;
    this.clear(false);
    accepted?.();
  }

  private clear(notify: boolean): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    const pending = this.pending;
    this.pending = null;
    if (notify) pending?.decline?.();
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear(true);
    this.disposed = true;
  }
  cancel(): void {
    this.clear(false);
  }
}
