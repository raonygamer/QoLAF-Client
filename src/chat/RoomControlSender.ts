import type {} from '../game/InitialWorld';
import {
  GameScene,
  GUID,
  JoinRoomLocator,
  MessageLog,
  PlayerManager,
  type Room,
} from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { ClientIPCQueue } from '../ipc/ClientIPCQueue';
import type { IPCMessage, IPCValue } from '../ipc/ClientIPCCodec';
import { gameRecoveryActive } from '../service/GameRecovery';
import { escapeRoomControlText as escape, isRoomOperator } from './RoomControlIdentity';
import {
  clampRoomKickReason,
  parseRoomControlReply,
  rememberRoomControlRequest,
  roomInviteWindow,
  roomRequestWindow,
  validInvitedService,
} from './RoomControlProtocol';
import { parseRoomPeerTargets, type RoomPeerTarget } from './RoomPeerTargets';

interface Outgoing {
  id: string;
  name: string;
  type: 'qipc3.room.invite' | 'qipc3.room.kick';
  expiresAt: number;
}

/** Private sender; receipts can acknowledge only a previously queued request. */
export class RoomControlSender {
  private readonly ipc = ClientIPCService.instance;
  private readonly outgoing = new Map<string, Outgoing>();
  private disposed = false;
  private lookupGeneration = 0;
  private lookupTimer?: ReturnType<typeof setTimeout>;
  private readonly gameRef: WeakRef<GameScene>;

  constructor(game: GameScene) {
    this.gameRef = new WeakRef(game);
    this.ipc?.addMessageHandler('qipc3.room.reply', this.onReply);
  }
  private get game(): GameScene {
    const game = this.gameRef.deref();
    if (!game) throw new Error('The room-control scene has been disposed.');
    return game;
  }
  private current(): boolean {
    const game = this.gameRef.deref();
    return (
      !this.disposed &&
      !!game &&
      GameScene.instance === game &&
      !game.get_isLeaving() &&
      !!game.get_me()
    );
  }
  private ready(): boolean {
    if (!this.current() || !isRoomOperator(this.game.get_me()!.id))
      return this.error('Only client operators can send room invitations or kicks.');
    if (
      this.game.noAutoReconnect ||
      !this.game.get_connected() ||
      !this.game.serviceConnection?.get_connected() ||
      gameRecoveryActive(JoinRoomLocator.getService()) ||
      !this.game.get_initialWorldIsRevealed() ||
      this.game.get_me()!.get_isWarpJumping()
    )
      return this.error("Wait until you've finished connecting before trying again.");
    if (PlayerManager.banMinutes > 0 && PlayerManager.isAllChannels)
      return this.error('Room controls cannot be sent while private chat is restricted.');
    if (!this.ipc || this.ipc !== ClientIPCService.instance || !this.ipc.connected)
      return this.error('IPC is not connected. Try again shortly.');
    return true;
  }
  private error(text: string): false {
    MessageLog.write(text, 'error');
    return false;
  }
  private note(text: string, invite = false): void {
    MessageLog.write(
      invite
        ? `<font color='#ffcc33'>[Room invite] ${text}</font>`
        : `<FONT COLOR='#82cfff'>${text}</FONT>`,
    );
  }
  private inRoom = (id: string): boolean =>
    this.current() &&
    id !== this.game.get_me()!.id &&
    !!this.game.playerManager?.get_playersById().h[id];
  private serverSeconds(): number {
    return this.game.get_initialWorldIsRevealed()
      ? (this.game.clock?.getServerTime() ?? NaN) / 1000
      : NaN;
  }
  command(argument: string, kick: boolean): void {
    if (!this.ready()) return;
    const selected = parseRoomPeerTargets(
      argument,
      this.ipc!,
      this.game.get_me()!.id,
      this.inRoom,
      () => {
        this.error('That player is not connected to IPC. Room controls require an IPC peer.');
      },
    );
    const usage = kick
      ? 'Usage: /kickfromroom <@Peer|roompeers|allpeers|[@a,@b,@c]> <reason>'
      : 'Usage: /invitetoroom <@Peer|roompeers|allpeers|[@a,@b,@c]> [roomId|current].';
    if (!selected) {
      this.error(usage);
      return;
    }
    if (!selected.targets.length) {
      this.error('No IPC peers match that selector.');
      return;
    }
    if (kick) {
      const reason = clampRoomKickReason(selected.body);
      if (!reason) {
        this.error('A kick reason is required (up to 30 characters).');
        return;
      }
      const sent = selected.targets.filter((target) =>
        this.enqueue(target, 'qipc3.room.kick', [reason]),
      );
      if (sent.length)
        this.note(
          sent.length === 1
            ? `Kicking ${escape(sent[0]!.name)}...`
            : `Kicking ${sent.length} peers...`,
        );
      return;
    }
    if (selected.body && selected.body.split(/\s+/).length > 1) {
      this.error(usage);
      return;
    }
    this.cancelLookup();
    const id =
      !selected.body || /^(current|-)$/i.test(selected.body)
        ? (this.game.room.id ?? '')
        : selected.body;
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id)) {
      this.error('Invalid Game room ID.');
      return;
    }
    if (this.game.room.id === id) {
      this.sendInvites(selected.targets, id, this.game.room.data);
      return;
    }
    const generation = this.lookupGeneration;
    const sourceRoom = this.game.room,
      sourceService = this.game.serviceConnection;
    this.lookupTimer = setTimeout(() => {
      if (!this.current() || generation !== this.lookupGeneration) return;
      this.cancelLookup();
      this.error("Couldn't find that room. Try the invite again.");
    }, 8000);
    const failed = () => {
      if (!this.current() || generation !== this.lookupGeneration) return;
      this.cancelLookup();
      this.error("Couldn't find that Game room.");
    };
    const scan = (offset: number) => {
      try {
        this.game.client.multiplayer.listRooms(
          'game',
          {},
          1000,
          offset,
          (rooms) => {
            if (
              !this.current() ||
              generation !== this.lookupGeneration ||
              this.game.room !== sourceRoom ||
              this.game.serviceConnection !== sourceService
            )
              return;
            const room = rooms.find((entry) => entry.id === id);
            if (room) {
              this.cancelLookup();
              if (this.ready()) this.sendInvites(selected.targets, id, room.data);
              return;
            }
            if (rooms.length === 1000 && offset < 4000) {
              scan(offset + 1000);
              return;
            }
            this.cancelLookup();
            this.error("That Game room isn't listed. Send the invite from inside a hidden room.");
          },
          failed,
        );
      } catch {
        failed();
      }
    };
    scan(0);
  }
  private sendInvites(targets: RoomPeerTarget[], id: string, data: Room['data']): void {
    if (data.service === ClientIPCService.roomId) {
      this.error('This service room is reserved for IPC.');
      return;
    }
    const system =
      typeof data.solarSystemKey === 'string'
        ? this.game.dataManager.loadKey('SolarSystems', data.solarSystemKey)
        : null;
    if (
      !system ||
      (data.systemType !== 'friendly' && data.systemType !== 'hostile') ||
      typeof data.service !== 'string' ||
      !validInvitedService(data.service) ||
      data.clanInstance === true ||
      data.clanInstance === 'true'
    ) {
      this.error('You can only invite players to PvE or PvP rooms, not clan instances.');
      return;
    }
    const primary =
      this.game.room.id === id ? this.game.serviceConnection?.get_roomId() : data.service;
    if (!primary || !validInvitedService(primary)) {
      this.error('The destination Service is unavailable.');
      return;
    }
    const payload: IPCValue[] = [
      id,
      String(data.solarSystemKey),
      data.systemType,
      data.service,
      primary,
    ];
    const name = system.name + (data.systemType === 'friendly' ? ' (PvE)' : ' (PvP)');
    const sent = targets.filter((target) => this.enqueue(target, 'qipc3.room.invite', payload));
    if (sent.length)
      this.note(
        `Inviting ${sent.length === 1 ? escape(sent[0]!.name) : `${sent.length} peers`} to ${escape(name)}...`,
        true,
      );
  }
  private prune(): void {
    const now = performance.now();
    for (const [nonce, request] of this.outgoing)
      if (now >= request.expiresAt) this.outgoing.delete(nonce);
  }
  private enqueue(target: RoomPeerTarget, type: Outgoing['type'], payload: IPCValue[]): boolean {
    if (!this.ready()) return false;
    const ipc = this.ipc!;
    const peer = ipc.findPeer(target.id);
    if (!peer || peer.id !== target.id)
      return this.error('That player is not connected to IPC. Room controls require an IPC peer.');
    if (!Number.isFinite(this.serverSeconds()))
      return this.error('Still synchronizing. Try again in a moment.');
    this.prune();
    if (this.outgoing.size >= 64) return this.error('Too many room requests are pending.');
    const nonce = GUID.create().replace(/-/g, '').toUpperCase();
    const room = this.game.room,
      service = this.game.serviceConnection;
    const windowMs = type === 'qipc3.room.invite' ? roomInviteWindow : roomRequestWindow;
    const request: Outgoing = {
      ...peer,
      type,
      expiresAt: performance.now() + 2 * ClientIPCQueue.maxQueueMs + windowMs + 10000,
    };
    this.outgoing.set(nonce, request);
    const accepted = ipc.send(
      peer.id,
      { type, fields: [] },
      {
        onSent: () => {
          request.expiresAt = performance.now() + ClientIPCQueue.maxQueueMs + windowMs + 10000;
        },
        onError: (reason) => {
          this.outgoing.delete(nonce);
          if (this.current()) this.error('Room request failed: ' + escape(reason));
        },
        beforeSend: () => {
          if (
            !this.current() ||
            !isRoomOperator(this.game.get_me()!.id) ||
            this.game.room !== room ||
            this.game.serviceConnection !== service ||
            this.game.noAutoReconnect ||
            !this.game.get_connected() ||
            !service?.get_connected() ||
            !this.game.get_initialWorldIsRevealed() ||
            gameRecoveryActive(JoinRoomLocator.getService()) ||
            this.game.get_me()!.get_isWarpJumping() ||
            ipc !== ClientIPCService.instance ||
            !ipc.connected ||
            (PlayerManager.banMinutes > 0 && PlayerManager.isAllChannels) ||
            (target.roomScoped && !this.inRoom(peer.id)) ||
            ipc.findPeer(peer.id)?.id !== peer.id
          )
            return null;
          const now = this.serverSeconds();
          return Number.isFinite(now)
            ? { type, fields: ['game', peer.id, nonce, now, ...payload] }
            : null;
        },
      },
    );
    if (!accepted) this.outgoing.delete(nonce);
    return accepted;
  }
  private onReply = (message: IPCMessage, senderId: string, senderName: string): void => {
    if (!this.current()) return;
    const reply = parseRoomControlReply(message, this.game.get_me()!.id, this.serverSeconds());
    if (!reply) return;
    this.prune();
    const request = this.outgoing.get(reply.requestNonce);
    if (
      !request ||
      request.id !== senderId ||
      request.type !== reply.requestType ||
      !rememberRoomControlRequest(senderId, reply.nonce)
    )
      return;
    this.outgoing.delete(reply.requestNonce);
    if (reply.requestType === 'qipc3.room.invite')
      this.note(`${escape(senderName)} ${reply.result} the room invite.`, true);
    else {
      const player = this.game.get_me()!;
      MessageLog.write(
        `<FONT COLOR='#ff8a8a'>${escape(request.name)} was kicked from the room by ${escape(player.get_name() || player.id)}.</FONT>`,
      );
      if (this.ipc === ClientIPCService.instance && this.ipc?.connected)
        this.ipc.broadcast({ type: 'qipc3.room.kickNotice', fields: [request.id, request.name] });
    }
  };
  private cancelLookup(): void {
    this.lookupGeneration++;
    clearTimeout(this.lookupTimer);
    this.lookupTimer = undefined;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelLookup();
    this.outgoing.clear();
    this.ipc?.removeMessageHandler('qipc3.room.reply', this.onReply);
  }
}
