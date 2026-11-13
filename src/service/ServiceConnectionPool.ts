import { isValidServiceHandshake, type ServiceHandshakeMessage } from './ServiceHandshake';
import type { Message, GameScene, Connection, Client, PlayerIOError } from '../game/Bindings';
import { serviceGameIsReady } from './ServiceGameReadiness';
import { ServiceConnectionLease, type ServiceLeaseOwner } from './ServiceConnectionLease';

export interface ServicePoolRuntime {
  currentGame(): GameScene | null;
  serverVersion(): number;
  reservedRoom(): string;
  reservedMessage: string;
  clientVersion(): number;
  now(): number;
  every(milliseconds: number, callback: () => void): () => void;
  defer(callback: () => void): void;
}

const messageTypes = ['joined', 'error', 'kicked', 'duplicateLogin', 'chatBan'];

/** Source per-game, join-only pool. It never publishes or initializes a primary session. */
export class ServiceConnectionPool {
  private entries = new Set<ServiceRoom>();
  constructor(readonly runtime: ServicePoolRuntime) {}

  serviceIdFromIndex(value: string | null): string | null {
    if (!value || /[^0-9]/.test(value)) return null;
    const index = Number(value);
    return Number.isFinite(index) && index <= 2147483647
      ? `Service-${this.runtime.serverVersion()}_${index}`
      : null;
  }

  isValidServiceId(room: string | null): boolean {
    const prefix = `Service-${this.runtime.serverVersion()}_`;
    return (
      !!room &&
      room !== this.runtime.reservedRoom() &&
      room.startsWith(prefix) &&
      room === this.serviceIdFromIndex(room.slice(prefix.length))
    );
  }

  static isValidServiceHandshake(
    message: ServiceHandshakeMessage | null,
    playerId: string | null,
  ): boolean {
    return isValidServiceHandshake(message, playerId);
  }

  acquire(
    game: GameScene,
    roomId: string,
    ready: (connection: Connection | null) => void,
    lost: (reason: string, kind: string) => void,
  ): ServiceConnectionLease {
    let room = [...this.entries].find(
      (entry) => entry.game === game && entry.roomId === roomId && entry.running,
    );
    const created = !room;
    if (!room) {
      room = new ServiceRoom(this, game, roomId);
      this.entries.add(room);
    }
    const lease = new ServiceConnectionLease(room, ready, lost);
    room.leases.add(lease);
    if (created) room.start();
    else if (room.readyConnection) room.notifyReady(lease);
    return lease;
  }

  connectedRoomIds(game: GameScene): string[] {
    return [...this.entries]
      .filter(
        (room) =>
          room.game === game &&
          room.readyConnection &&
          game.serviceConnection?.get_roomId() !== room.roomId,
      )
      .map((room) => room.roomId)
      .sort();
  }

  hasService(game: GameScene, id: string): boolean {
    return [...this.entries].some(
      (room) => room.game === game && room.roomId === id && room.running && room.ownerIsCurrent(),
    );
  }

  takeReadyForPrimary(
    game: GameScene,
    id: string,
  ): { connection: Connection; joined: Message } | null {
    const room = [...this.entries].find(
      (room) =>
        room.game === game &&
        room.roomId === id &&
        !room.primaryOwned &&
        room.readyConnection &&
        room.joinedMessage,
    );
    if (!room) return null;
    room.primaryOwned = true;
    return { connection: room.readyConnection!, joined: room.joinedMessage! };
  }

  releasePrimary(game: GameScene, connection: Connection | null): boolean {
    const room =
      connection &&
      [...this.entries].find(
        (room) =>
          room.game === game && room.socket === connection && room.running && room.leases.size > 0,
      );
    if (!room) return false;
    room.primaryOwned = false;
    return true;
  }

  retireDisconnectedPrimary(game: GameScene, connection: Connection | null): void {
    if (!connection || connection.get_connected()) return;
    for (const room of [...this.entries])
      if (room.game === game && room.socket === connection)
        room.stop('The main Service connection was refreshed.', 'disconnect');
  }

  disposeFor(game: GameScene): void {
    for (const room of [...this.entries])
      if (room.game === game)
        room.stop('Service connections closed because the game is leaving.', 'disconnect');
  }

  remove(room: ServiceRoom): void {
    this.entries.delete(room);
  }

  detachHandlers(
    connection: Connection,
    types: string[],
    message: ((message: Message) => void) | null,
    disconnected: (() => void) | null = null,
  ): void {
    // PlayerIO dispatches live handler arrays; invalidate synchronously, detach next turn.
    this.runtime.defer(() => {
      if (message) for (const type of types) connection.removeMessageHandler(type, message);
      if (disconnected) connection.removeDisconnectHandler(disconnected);
    });
  }
}

class ServiceRoom implements ServiceLeaseOwner {
  readonly leases = new Set<ServiceConnectionLease>();
  private client: Client | null;
  readonly playerId: string | null;
  socket: Connection | null = null;
  joinedMessage: Message | null = null;
  primaryOwned = false;
  running = false;
  private initialized = false;
  private generation = 0;
  private deadline = 0;
  private banUntil = 0;
  private banAll = false;
  private messageHandler: ((message: Message) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private stopPoll: (() => void) | null = null;

  constructor(
    private pool: ServiceConnectionPool,
    public game: GameScene | null,
    readonly roomId: string,
  ) {
    this.client = game?.client ?? null;
    this.playerId = game?.get_me()?.id ?? null;
  }

  ownerIsCurrent(): boolean {
    return (
      !!this.game &&
      this.pool.runtime.currentGame() === this.game &&
      !this.game.get_isLeaving() &&
      !!this.client &&
      this.game.client === this.client &&
      !!this.playerId &&
      this.game.get_me()?.id === this.playerId
    );
  }

  get readyConnection(): Connection | null {
    return this.running &&
      this.initialized &&
      this.ownerIsCurrent() &&
      this.socket &&
      this.socket.get_connected() &&
      this.socket.get_roomId() === this.roomId
      ? this.socket
      : null;
  }
  get chatBanMinutes(): number {
    return Math.max(0, Math.ceil((this.banUntil - this.pool.runtime.now()) / 60000));
  }
  get chatBanAllChannels(): boolean {
    return this.banAll;
  }
  private get hasPrimaryLifecycle(): boolean {
    return this.primaryOwned || (!!this.socket && this.socket === this.game?.serviceConnection);
  }

  release(lease: ServiceConnectionLease): void {
    this.leases.delete(lease);
    if (this.leases.size) return;
    if (!this.primaryOwned && this.socket && this.socket === this.game?.serviceConnection) return;
    this.stop(null);
  }

  start(): void {
    this.running = true;
    if (this.roomId === this.pool.runtime.reservedRoom())
      return this.stop(this.pool.runtime.reservedMessage);
    if (!this.ownerIsCurrent() || !serviceGameIsReady(this.game))
      return this.stop('Wait until your current game connection is ready.');
    if (!this.pool.isValidServiceId(this.roomId)) return this.stop('Invalid Service room ID.');
    if (this.game!.serviceConnection?.get_roomId() === this.roomId)
      return this.stop(`You are already in ${this.roomId}. Use your main chat for this room.`);
    this.deadline = this.pool.runtime.now() + 8000;
    const attempt = ++this.generation;
    let answered = false;
    let accepted: Connection | undefined;
    this.stopPoll = this.pool.runtime.every(250, () => this.poll());
    try {
      this.client!.multiplayer.joinRoom(
        this.roomId,
        { client_version: this.pool.runtime.clientVersion() },
        (next: Connection) => {
          if (answered) {
            if (next !== accepted) this.closeCandidate(next);
            return;
          }
          if (!this.running || attempt !== this.generation || !this.ownerIsCurrent()) {
            this.closeCandidate(next);
            return;
          }
          answered = true;
          accepted = next;
          if (!next || next === this.game!.serviceConnection || next.get_roomId() !== this.roomId) {
            this.closeCandidate(next);
            this.stop(`Couldn't verify the connection to ${this.roomId}.`);
            return;
          }
          this.socket = next;
          this.messageHandler = (message) => {
            if (this.running && attempt === this.generation && this.socket === next)
              this.receive(message);
          };
          this.disconnectHandler = () => {
            if (
              this.running &&
              attempt === this.generation &&
              this.socket === next &&
              !this.hasPrimaryLifecycle
            )
              this.stop(`Disconnected from ${this.roomId}.`, 'disconnect');
          };
          for (const type of messageTypes) next.addMessageHandler(type, this.messageHandler);
          next.addDisconnectHandler(this.disconnectHandler);
          if (!next.get_connected())
            this.stop(`${this.roomId} disconnected before chat was ready.`, 'disconnect');
        },
        (failure: PlayerIOError) => {
          if (answered) return;
          answered = true;
          if (this.running && attempt === this.generation)
            this.stop(`Couldn't connect to ${this.roomId}: ${failure.message}`);
        },
      );
    } catch (error) {
      if (this.running && attempt === this.generation)
        this.stop(`Couldn't connect to ${this.roomId}: ${String(error)}`);
    }
  }

  private receive(message: Message): void {
    if (!this.ownerIsCurrent()) {
      if (!this.hasPrimaryLifecycle) this.stop('The game connection changed.', 'disconnect');
      return;
    }
    if (!message) return;
    if (message.type === 'chatBan') {
      try {
        const minutes = Math.max(0, message.getInt(0));
        this.banAll = message.getBoolean(1);
        this.banUntil = this.pool.runtime.now() + minutes * 60000;
      } catch {
        if (!this.hasPrimaryLifecycle)
          this.stop(`${this.roomId} returned an invalid chat restriction.`);
      }
      return;
    }
    if (message.type !== 'joined') {
      if (this.hasPrimaryLifecycle) return;
      let reason = message.type;
      try {
        if (message.type === 'error' && message.length > 0) reason = message.getString(0);
      } catch {}
      this.stop(`${this.roomId} rejected the connection: ${reason}`);
      return;
    }
    if (this.initialized) return;
    if (
      !ServiceConnectionPool.isValidServiceHandshake(message, this.playerId) ||
      !this.socket ||
      !this.socket.get_connected() ||
      this.socket.get_roomId() !== this.roomId
    ) {
      this.stop(`${this.roomId} did not return a valid Service response for your account.`);
      return;
    }
    this.initialized = true;
    this.joinedMessage = message;
    for (const lease of [...this.leases]) {
      if (!this.running) break;
      if (this.leases.has(lease)) this.notifyReady(lease);
    }
  }

  notifyReady(lease: ServiceConnectionLease): void {
    try {
      lease.ready(this.readyConnection);
    } catch {
      try {
        lease.lost("Couldn't initialize the Service connection consumer.", 'error');
      } catch {}
      this.release(lease);
    }
  }

  private poll(): void {
    if (!this.running) return;
    if (!this.ownerIsCurrent()) this.stop('The game connection changed.', 'disconnect');
    else if (
      !this.leases.size &&
      !this.primaryOwned &&
      this.socket !== this.game?.serviceConnection
    )
      this.stop(null);
    else if (this.socket && !this.socket.get_connected())
      this.stop(`Disconnected from ${this.roomId}.`, 'disconnect');
    else if (!this.initialized && this.pool.runtime.now() >= this.deadline)
      this.stop(`${this.roomId} didn't respond within 8 seconds.`, 'timeout');
  }

  stop(reason: string | null, kind = 'error'): void {
    this.running = this.initialized = false;
    this.generation++;
    this.stopPoll?.();
    this.stopPoll = null;
    this.pool.remove(this);
    const previous = this.socket;
    this.socket = null;
    if (previous) {
      this.pool.detachHandlers(previous, messageTypes, this.messageHandler, this.disconnectHandler);
      if (!this.primaryOwned) this.closeCandidate(previous);
    }
    this.messageHandler = this.disconnectHandler = null;
    this.joinedMessage = null;
    const leases = [...this.leases];
    this.leases.clear();
    for (const lease of leases) {
      try {
        lease.lost(reason ?? 'Service connection closed.', kind);
      } catch {}
    }
    this.game = null;
    this.client = null;
  }

  private closeCandidate(candidate: Connection | null): void {
    if (
      !candidate ||
      candidate === this.game?.serviceConnection ||
      candidate === this.pool.runtime.currentGame()?.serviceConnection
    )
      return;
    try {
      candidate.disconnect();
    } catch {}
  }
}
