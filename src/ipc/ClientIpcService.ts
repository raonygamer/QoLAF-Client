import { ClientIpcAssembler } from './ClientIpcAssembler';
import { ClientIpcCodec, type IpcMessage } from './ClientIpcCodec';
import { ClientIpcMessagePack } from './ClientIpcMessagePack';
import { ClientIpcPolicy, type IpcChannel } from './ClientIpcPolicy';
import {
  ClientIpcQueue,
  type IpcPeerTarget,
  type IpcQueueItem,
  type IpcSendCallbacks,
} from './ClientIpcQueue';

export interface IpcServerMessage {
  type: string;
  fields: unknown[];
}
export interface IpcSocket {
  readonly connected: boolean;
  readonly roomId: string;
  addMessageHandler(type: string, handler: (message: IpcServerMessage) => void): void;
  removeMessageHandler(type: string, handler: (message: IpcServerMessage) => void): void;
  addDisconnectHandler(handler: () => void): void;
  removeDisconnectHandler(handler: () => void): void;
  send(type: string, ...fields: string[]): void;
  disconnect(): void;
}
export interface IpcClient {
  readonly connectUserId: string;
  createJoinRoom(
    roomId: string,
    roomType: string,
    visible: boolean,
    roomData: Record<string, unknown>,
    joinData: Record<string, unknown>,
    success: (socket: IpcSocket) => void,
    failure: (error: unknown) => void,
  ): void;
}
export interface IpcEnvironment {
  now(): number;
  random(): number;
  interval(callback: () => void, ms: number): () => void;
  defer(callback: () => void): void;
  debug(text: string): void;
}
export interface IpcLoginInfo {
  id: string;
  loginId: string;
  version: string;
  build: 'Public' | 'Private';
}
interface Peer extends IpcPeerTarget, IpcLoginInfo {
  retiredSessions: string[];
  lastSeen: number;
  lastReply: number;
  replyToken: string | null;
  replyExpires: number;
  replyQueued: boolean;
  latestHelloToken: string | null;
  discoveryNotified: boolean;
  helloTokens: string[];
  ackSends: number;
}
interface RecentTarget {
  id: string;
  name: string;
  peer: Peer;
  token: string;
  seenVersion: number;
  time: number;
}
type MessageHandler = (message: IpcMessage, senderId: string, senderName: string) => void;
type PeerHandler = (id: string, name: string) => void;
const browserEnvironment: IpcEnvironment = {
  now: () => performance.now(),
  random: () => Math.random(),
  interval: (callback, ms) => {
    const timer = setInterval(callback, ms);
    return () => clearInterval(timer);
  },
  defer: (callback) => {
    setTimeout(callback, 0);
  },
  debug: () => {},
};

/** Authentication-owned hidden Service socket; never retains a Game or scene timer. */
export class ClientIpcService {
  static readonly serviceIndex = 24;
  private static activeServerVersion = 1409;
  static get serverVersion(): number {
    return this.activeServerVersion;
  }
  static get roomId(): string {
    return `Service-${this.activeServerVersion}_${this.serviceIndex}`;
  }
  /** A game release moves the service address as well as its handshake version. */
  static setServerVersion(version: number): void {
    if (!Number.isSafeInteger(version) || version <= 0)
      throw new Error('Invalid IPC server version');
    if (version === this.activeServerVersion) return;
    this.shutdown();
    this.activeServerVersion = version;
  }
  static readonly reservedMessage = 'This service room is reserved for IPC.';
  static readonly discoverySchema = 4;
  private static singleton: ClientIpcService | null = null;
  private static readonly types = [
    'joined',
    'chatMsg',
    'clientPrintMsg',
    'chatBan',
    'error',
    'kicked',
    'duplicateLogin',
  ];
  private readonly playerId: string;
  private readonly ownVersion: string;
  private readonly ownBuild: 'Public' | 'Private';
  private readonly ownLoginId: string;
  private connection: IpcSocket | null = null;
  private messageHandler: ((message: IpcServerMessage) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private stopTimer: (() => void) | null = null;
  private running = false;
  private initialized = false;
  private joining = false;
  private generation = 0;
  private retryCount = 0;
  private retryAt = 0;
  private joinDeadline = 0;
  private banUntil = 0;
  private banAll = false;
  private pauseUntil = 0;
  private manualPause = false;
  private nextSweep = 0;
  private readonly peers = new Map<string, Peer>();
  private readonly listeners = new Map<string, Set<MessageHandler>>();
  private readonly peerHandlers = new Set<PeerHandler>();
  private readonly disposeHandlers = new Set<() => void>();
  private readonly assembler = new ClientIpcAssembler();
  private readonly queue: ClientIpcQueue;
  private recentTargets: RecentTarget[] = [];
  private messageSeed: string;
  private messageCounter = 0;
  private helloToken = '';
  private ownSessionId: string | null = null;
  private helloPending = false;
  private helloSent = false;
  private helloAcceptUntil = 0;
  private helloSends = 0;
  private nextHelloAt = 0;
  private discoveryStartedAt = 0;
  private nextPresenceAt = 0;
  private presencePending = false;
  private gracefulByeSent = false;
  private debugEnabled = false;

  private constructor(
    private client: IpcClient | null,
    versionLabel: string,
    private readonly environment: IpcEnvironment,
  ) {
    const label = /^([0-9.]+) \((Public|Private)\)$/.exec(versionLabel);
    if (
      !label ||
      versionLabel !== `${label[1]} (${label[2]})` ||
      !ClientIpcPolicy.validVersion(label[1]) ||
      !ClientIpcPolicy.validBuild(label[2])
    )
      throw Error('Invalid IPC client version label.');
    this.ownVersion = label[1];
    this.ownBuild = label[2];
    this.playerId = client!.connectUserId;
    this.messageSeed = this.randomHex(8);
    this.ownLoginId = this.nextId();
    const service = this;
    this.queue = new ClientIpcQueue({
      now: () => environment.now(),
      nextId: () => this.nextId(),
      current: () => this.current(),
      get connected() {
        return service.connected;
      },
      get paused() {
        return service.paused;
      },
      get generation() {
        return service.generation;
      },
      peer: (id) => this.peers.get(id),
      write: (target, name, frame) => {
        if (target === 'peerMessage') this.connection!.send('chatMsg', 'private', name!, frame);
        else this.connection!.send('chatMsg', 'local', frame);
      },
      written: (item, peer, at, first) => this.written(item, peer as Peer | undefined, at, first),
      lost: (reason) => this.lost(reason),
    });
  }

  static get instance(): ClientIpcService | null {
    return this.singleton;
  }
  static ensure(
    owner: IpcClient | null,
    versionLabel: string,
    environment: IpcEnvironment = browserEnvironment,
  ): ClientIpcService | null {
    if (!owner?.connectUserId) {
      this.shutdown();
      return null;
    }
    if (
      this.singleton &&
      (this.singleton.client !== owner || this.singleton.playerId !== owner.connectUserId)
    )
      this.shutdown();
    if (!this.singleton) {
      const service = new ClientIpcService(owner, versionLabel, environment);
      this.singleton = service;
      service.running = true;
      service.stopTimer = environment.interval(() => service.tick(), 50);
      service.join();
    }
    return this.singleton;
  }
  static shutdown(): void {
    const previous = this.singleton;
    this.singleton = null;
    previous?.dispose();
  }
  static prepareForHostClose(): void {
    this.singleton?.quiesceForHostClose();
  }

  get connected(): boolean {
    return (
      this.current() &&
      this.initialized &&
      !!this.connection?.connected &&
      this.connection.roomId === ClientIpcService.roomId
    );
  }
  get sessionId(): string | null {
    return this.connected ? this.ownSessionId : null;
  }
  get loginId(): string | null {
    return this.current() ? this.ownLoginId : null;
  }
  ownLoginInfo(): IpcLoginInfo | null {
    return this.current()
      ? {
          id: this.playerId,
          loginId: this.ownLoginId,
          version: this.ownVersion,
          build: this.ownBuild,
        }
      : null;
  }
  peerSessionId(id: string): string | null {
    return this.connected ? (this.peers.get(id)?.sessionId ?? null) : null;
  }
  peerLoginInfo(id: string): (IpcLoginInfo & { name: string }) | null {
    const peer = this.peers.get(id);
    return this.connected && peer?.discoveryNotified
      ? {
          id: peer.id,
          name: peer.name,
          loginId: peer.loginId,
          version: peer.version,
          build: peer.build,
        }
      : null;
  }
  get paused(): boolean {
    const now = this.environment.now();
    return this.manualPause || now < this.pauseUntil || (this.banAll && now < this.banUntil);
  }
  set paused(value: boolean) {
    this.manualPause = value;
    if (value) this.queue.fail('IPC is paused.');
  }
  toggleDebug(): boolean {
    return (this.debugEnabled = !this.debugEnabled);
  }
  get statusText(): string {
    return (
      ClientIpcService.roomId +
      (!this.running
        ? ' (offline)'
        : this.paused
          ? ' (paused)'
          : this.connected
            ? ` (online, ${this.peers.size} peers)`
            : this.joining
              ? ' (connecting)'
              : ' (reconnecting)')
    );
  }
  get onlinePlayers(): Array<{ id: string; name: string }> {
    return [...this.peers.values()]
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) =>
        a.name.toLowerCase() < b.name.toLowerCase()
          ? -1
          : a.name.toLowerCase() > b.name.toLowerCase()
            ? 1
            : 0,
      );
  }
  findPeer(value: string): { id: string; name: string } | null {
    if (typeof value !== 'string') return null;
    value = value.trim();
    const explicitName = value.startsWith('@');
    if (explicitName) value = value.slice(1);
    const direct = explicitName ? undefined : this.peers.get(value);
    if (direct) return { id: direct.id, name: direct.name };
    let match: Peer | undefined;
    for (const peer of this.peers.values()) {
      if (peer.name.toLowerCase() !== value.toLowerCase()) continue;
      if (match) return null;
      match = peer;
    }
    return match ? { id: match.id, name: match.name } : null;
  }
  addMessageHandler(type: string, handler: MessageHandler): void {
    if (
      !handler ||
      typeof type !== 'string' ||
      !type.startsWith('qipc3.') ||
      type.startsWith('qipc3.ipc.') ||
      type === ClientIpcMessagePack.type
    )
      return;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }
  removeMessageHandler(type: string, handler: MessageHandler): void {
    const handlers = this.listeners.get(type);
    handlers?.delete(handler);
    if (handlers?.size === 0) this.listeners.delete(type);
  }
  addPeerHandler(handler: PeerHandler): void {
    this.peerHandlers.add(handler);
  }
  removePeerHandler(handler: PeerHandler): void {
    this.peerHandlers.delete(handler);
  }
  addDisposeHandler(handler: () => void): void {
    this.disposeHandlers.add(handler);
  }
  removeDisposeHandler(handler: () => void): void {
    this.disposeHandlers.delete(handler);
  }

  send(target: string, message: IpcMessage, callbacks: IpcSendCallbacks = {}): boolean {
    if (!this.connected) return ClientIpcQueue.reject(callbacks.onError, 'IPC is not connected.');
    if (this.paused)
      return ClientIpcQueue.reject(
        callbacks.onError,
        'IPC is paused by a chat restriction or user pause.',
      );
    const peer = this.findPeer(target);
    if (!peer) return ClientIpcQueue.reject(callbacks.onError, 'That player is not online in IPC.');
    if (!message || !ClientIpcPolicy.applicationAllowed(message.type, 'private'))
      return ClientIpcQueue.reject(callbacks.onError, 'Invalid application IPC message.');
    return this.queue.enqueue(peer.id, peer.name, 'peerMessage', message, callbacks);
  }
  broadcast(message: IpcMessage, callbacks: IpcSendCallbacks = {}): boolean {
    if (!this.connected) return ClientIpcQueue.reject(callbacks.onError, 'IPC is not connected.');
    if (this.paused)
      return ClientIpcQueue.reject(
        callbacks.onError,
        'IPC is paused by a chat restriction or user pause.',
      );
    if (!message || !ClientIpcPolicy.applicationAllowed(message.type, 'local'))
      return ClientIpcQueue.reject(callbacks.onError, 'This IPC message type cannot be broadcast.');
    return this.queue.enqueue(null, null, 'broadcastLocal', message, callbacks);
  }

  private current(): boolean {
    return (
      this.running &&
      ClientIpcService.singleton === this &&
      this.client?.connectUserId === this.playerId
    );
  }
  private join(): void {
    if (!this.current() || this.joining || this.connection) return;
    this.joining = true;
    this.initialized = false;
    this.joinDeadline = this.environment.now() + 8000;
    const attempt = ++this.generation;
    try {
      this.client!.createJoinRoom(
        ClientIpcService.roomId,
        'service',
        false,
        {},
        { client_version: ClientIpcService.serverVersion },
        (next) => {
          if (!this.current() || attempt !== this.generation || !this.joining) {
            this.close(next);
            return;
          }
          if (!next || next.roomId !== ClientIpcService.roomId) {
            this.close(next);
            this.lost('IPC could not verify its room.');
            return;
          }
          this.connection = next;
          this.messageHandler = (message) => {
            if (this.current() && attempt === this.generation && this.connection === next)
              this.receive(message);
          };
          this.disconnectHandler = () => {
            if (this.current() && attempt === this.generation && this.connection === next)
              this.lost('IPC disconnected.');
          };
          for (const type of ClientIpcService.types)
            next.addMessageHandler(type, this.messageHandler);
          next.addDisconnectHandler(this.disconnectHandler);
          if (!next.connected) this.lost('IPC disconnected before initialization.');
        },
        () => {
          if (this.current() && attempt === this.generation) this.lost('IPC could not connect.');
        },
      );
    } catch {
      if (this.current() && attempt === this.generation) this.lost('IPC could not connect.');
    }
  }

  private receive(message: IpcServerMessage): void {
    if (!message) return;
    const { type, fields } = message;
    if (type === 'joined') {
      if (this.initialized) return;
      if (
        !this.connection?.connected ||
        this.connection.roomId !== ClientIpcService.roomId ||
        !ClientIpcPolicy.validHandshake(fields, this.playerId)
      ) {
        this.lost('IPC returned an invalid Service handshake.');
        return;
      }
      this.initialized = true;
      this.joining = false;
      this.retryCount = 0;
      this.peers.clear();
      this.assembler.clear();
      this.ownSessionId = this.nextId();
      this.gracefulByeSent = this.presencePending = false;
      this.nextPresenceAt = this.environment.now() + 60000;
      this.beginDiscovery();
      this.announce();
      return;
    }
    if (type === 'chatBan') {
      this.receiveBan(fields);
      return;
    }
    if (type === 'duplicateLogin') {
      ClientIpcService.shutdown();
      return;
    }
    if (type === 'kicked') {
      this.pauseUntil = this.environment.now() + 60000;
      this.lost('IPC was disconnected by the server.');
      this.retryAt = Math.max(this.retryAt, this.pauseUntil);
      return;
    }
    if (type === 'error' && !this.initialized) {
      this.lost('IPC initialization was rejected.');
      return;
    }
    if (!this.initialized) return;
    if (
      type === 'clientPrintMsg' ||
      type === 'error' ||
      (type === 'chatMsg' && fields.length <= 2)
    ) {
      this.receiveNotice(message);
      return;
    }
    if (type !== 'chatMsg' || fields.length < 6) return;
    const [channel, body, sender, name] = fields;
    if (
      (channel !== 'local' && channel !== 'private') ||
      typeof body !== 'string' ||
      typeof name !== 'string' ||
      sender === this.playerId ||
      !ClientIpcPolicy.validIdentity(sender, name) ||
      !body.startsWith('qipc3.')
    )
      return;
    const decoded = this.assembler.accept(body, channel, sender, name, this.environment.now());
    if (!decoded) return;
    if (decoded.type === ClientIpcMessagePack.type) {
      const packed = ClientIpcMessagePack.decode(decoded);
      if (!packed || packed.some((child) => !ClientIpcPolicy.decodedAllowed(child, channel)))
        return;
      this.debugMessage(
        'IN',
        channel,
        sender,
        name,
        decoded.type,
        packed.map((child) => child.type),
      );
      for (const child of packed) this.dispatchDecoded(child, channel, sender, name);
    } else if (ClientIpcPolicy.decodedAllowed(decoded, channel)) {
      this.debugMessage('IN', channel, sender, name, decoded.type);
      this.dispatchDecoded(decoded, channel, sender, name);
    }
  }

  private dispatchDecoded(
    message: IpcMessage,
    channel: IpcChannel,
    sender: string,
    name: string,
  ): void {
    if (message.type === 'qipc3.ipc.hello' || message.type === 'qipc3.ipc.helloAck') {
      this.discover(message, channel, sender, name);
      return;
    }
    if (message.type === 'qipc3.ipc.presence' || message.type === 'qipc3.ipc.bye') {
      this.receivePresence(message, channel, sender, name);
      return;
    }
    if (!ClientIpcPolicy.applicationAllowed(message.type, channel)) return;
    const peer = this.peers.get(sender);
    if (!peer) {
      if (this.listeners.has(message.type)) this.requestDiscoveryRefresh();
      return;
    }
    this.touchPeer(peer, name);
    const handlers = this.listeners.get(message.type);
    if (!handlers) return;
    const generation = this.generation,
      session = peer.sessionId;
    for (const handler of [...handlers]) {
      if (
        !this.current() ||
        this.generation !== generation ||
        this.peers.get(sender) !== peer ||
        peer.sessionId !== session
      )
        break;
      if (!this.listeners.get(message.type)?.has(handler)) continue;
      try {
        handler(message, sender, name);
      } catch {
        /* Isolate consumers. */
      }
    }
  }

  private beginDiscovery(): void {
    this.helloToken = this.nextId();
    this.helloSends = 0;
    this.helloPending = this.helloSent = false;
    this.helloAcceptUntil = this.nextHelloAt = 0;
    this.discoveryStartedAt = this.environment.now();
  }
  private requestDiscoveryRefresh(): void {
    if (
      this.connected &&
      !this.helloPending &&
      this.environment.now() - this.discoveryStartedAt >= 60000
    )
      this.beginDiscovery();
  }
  private announce(): void {
    if (
      !this.connected ||
      this.paused ||
      this.helloPending ||
      this.helloSends >= 3 ||
      this.environment.now() < this.nextHelloAt
    )
      return;
    const attempt = this.generation,
      token = this.helloToken;
    this.helloPending = true;
    const accepted = this.queue.enqueue(
      null,
      null,
      'broadcastLocal',
      {
        type: 'qipc3.ipc.hello',
        fields: [4, this.ownSessionId!, token, this.ownLoginId, this.ownVersion, this.ownBuild],
      },
      {
        onSent: () => {
          if (!this.current() || this.generation !== attempt || this.helloToken !== token) return;
          this.helloPending = false;
          this.helloSent = true;
          this.helloSends++;
          this.helloAcceptUntil = this.environment.now() + 120000;
          this.nextHelloAt = this.environment.now() + (this.helloSends === 1 ? 15000 : 30000);
        },
        onError: () => {
          if (this.current() && this.generation === attempt && this.helloToken === token) {
            this.helloPending = false;
            this.nextHelloAt = this.environment.now() + 1000;
          }
        },
      },
    );
    if (!accepted) this.helloPending = false;
  }

  private discover(message: IpcMessage, channel: IpcChannel, sender: string, name: string): void {
    const [schema, first, second, login, version, build] = message.fields;
    if (
      message.fields.length !== 6 ||
      schema !== 4 ||
      typeof first !== 'string' ||
      typeof second !== 'string' ||
      typeof login !== 'string' ||
      !ClientIpcCodec.validId(first) ||
      !ClientIpcCodec.validId(second) ||
      !ClientIpcCodec.validId(login) ||
      !ClientIpcPolicy.validVersion(version) ||
      !ClientIpcPolicy.validBuild(build)
    )
      return;
    const hello = message.type === 'qipc3.ipc.hello';
    const token = hello ? second : first,
      session = hello ? first : second;
    if (
      hello
        ? channel !== 'local'
        : channel !== 'private' ||
          token !== this.helloToken ||
          !this.helloSent ||
          this.environment.now() > this.helloAcceptUntil
    )
      return;
    let peer = this.peers.get(sender);
    if (!peer) {
      if (this.peers.size >= 512) return;
      peer = {
        id: sender,
        name,
        sessionId: '',
        loginId: '',
        version: '',
        build,
        retiredSessions: [],
        seenVersion: 0,
        lastSeen: 0,
        lastReply: -10000,
        replyToken: null,
        replyExpires: 0,
        replyQueued: false,
        latestHelloToken: null,
        discoveryNotified: false,
        helloTokens: [],
        ackSends: 0,
      };
      this.peers.set(sender, peer);
    }
    if (
      peer.sessionId === session &&
      (peer.loginId !== login || peer.version !== version || peer.build !== build)
    )
      return;
    if (peer.sessionId !== session) {
      if (peer.retiredSessions.includes(session)) return;
      if (peer.sessionId) {
        peer.retiredSessions.push(peer.sessionId);
        if (peer.retiredSessions.length > 32) peer.retiredSessions.shift();
      }
      Object.assign(peer, {
        sessionId: session,
        loginId: login,
        version,
        build,
        lastReply: -10000,
        replyToken: null,
        replyExpires: 0,
        replyQueued: false,
        latestHelloToken: null,
        discoveryNotified: false,
        helloTokens: [],
        ackSends: 0,
      });
      this.assembler.discardPeer(sender, this.environment.now());
    }
    this.touchPeer(peer, name);
    if (!hello) {
      if (!peer.discoveryNotified) {
        peer.discoveryNotified = true;
        this.notifyPeer(peer);
      }
      return;
    }
    if (peer.helloTokens.includes(token)) {
      if (
        peer.latestHelloToken !== token ||
        peer.replyQueued ||
        peer.replyToken !== null ||
        peer.ackSends >= 3
      )
        return;
    } else {
      peer.helloTokens.push(token);
      if (peer.helloTokens.length > 32) peer.helloTokens.shift();
      peer.latestHelloToken = token;
      peer.ackSends = 0;
    }
    peer.replyToken = token;
    peer.replyExpires = this.environment.now() + 120000;
    this.queueReply(peer);
  }

  private queueReply(peer: Peer): void {
    if (
      !this.connected ||
      this.paused ||
      peer.replyQueued ||
      !peer.replyToken ||
      !this.queue.hasReplyCapacity
    )
      return;
    const now = this.environment.now();
    if (now >= peer.replyExpires) {
      peer.replyToken = null;
      return;
    }
    if (now - peer.lastReply < 10000) return;
    const attempt = this.generation,
      token = peer.replyToken,
      session = peer.sessionId,
      expires = peer.replyExpires;
    const current = () =>
      this.current() &&
      this.generation === attempt &&
      this.peers.get(peer.id) === peer &&
      peer.sessionId === session;
    peer.replyToken = null;
    peer.replyQueued = true;
    this.queue.enqueue(
      peer.id,
      peer.name,
      'peerMessage',
      {
        type: 'qipc3.ipc.helloAck',
        fields: [4, token, this.ownSessionId!, this.ownLoginId, this.ownVersion, this.ownBuild],
      },
      {
        onSent: () => {
          if (!current()) return;
          peer.replyQueued = false;
          peer.lastReply = this.environment.now();
          if (peer.latestHelloToken === token) peer.ackSends++;
          if (peer.latestHelloToken === token && !peer.discoveryNotified) {
            peer.discoveryNotified = true;
            this.notifyPeer(peer);
          }
        },
        onError: () => {
          if (!current()) return;
          peer.replyQueued = false;
          if (
            !peer.replyToken &&
            peer.latestHelloToken === token &&
            this.environment.now() < expires
          ) {
            peer.replyToken = token;
            peer.replyExpires = expires;
          }
        },
      },
    );
  }
  private notifyPeer(peer: Peer): void {
    const generation = this.generation,
      session = peer.sessionId;
    for (const handler of [...this.peerHandlers]) {
      if (
        !this.current() ||
        this.generation !== generation ||
        this.peers.get(peer.id) !== peer ||
        peer.sessionId !== session
      )
        break;
      if (!this.peerHandlers.has(handler)) continue;
      try {
        handler(peer.id, peer.name);
      } catch {
        /* Isolate consumers. */
      }
    }
  }
  private touchPeer(peer: Peer, name: string): void {
    peer.name = name;
    peer.seenVersion = (peer.seenVersion + 1) >>> 0;
    peer.lastSeen = this.environment.now();
  }
  private receivePresence(
    message: IpcMessage,
    channel: IpcChannel,
    sender: string,
    name: string,
  ): void {
    const [session, login] = message.fields;
    if (
      channel !== 'local' ||
      message.fields.length !== 2 ||
      typeof session !== 'string' ||
      typeof login !== 'string' ||
      !ClientIpcCodec.validId(session) ||
      !ClientIpcCodec.validId(login)
    )
      return;
    const peer = this.peers.get(sender);
    if (!peer) {
      this.requestDiscoveryRefresh();
      return;
    }
    if (peer.sessionId !== session || peer.loginId !== login) return;
    this.touchPeer(peer, name);
    if (message.type === 'qipc3.ipc.bye') this.forgetPeer(sender, false);
  }
  private queuePresence(now: number): void {
    if (
      !this.connected ||
      this.paused ||
      this.presencePending ||
      !this.ownSessionId ||
      now < this.nextPresenceAt
    )
      return;
    const attempt = this.generation,
      session = this.ownSessionId;
    const current = () =>
      this.current() && this.generation === attempt && this.ownSessionId === session;
    this.presencePending = true;
    const failed = () => {
      if (current()) {
        this.presencePending = false;
        this.nextPresenceAt = this.environment.now() + 1000;
      }
    };
    const accepted = this.queue.enqueue(
      null,
      null,
      'broadcastLocal',
      { type: 'qipc3.ipc.presence', fields: [session, this.ownLoginId] },
      {
        onSent: () => {
          if (current()) {
            this.presencePending = false;
            this.nextPresenceAt = this.environment.now() + 60000;
          }
        },
        onError: failed,
      },
    );
    if (!accepted && current() && this.presencePending) failed();
  }

  private receiveBan(fields: unknown[]): void {
    if (
      fields.length < 2 ||
      typeof fields[0] !== 'number' ||
      !Number.isFinite(fields[0]) ||
      typeof fields[1] !== 'boolean'
    ) {
      this.pauseUntil = this.environment.now() + 60000;
      this.queue.fail('IPC received an invalid chat restriction and is paused.');
      return;
    }
    this.banAll = fields[1];
    this.banUntil = this.environment.now() + Math.max(0, fields[0]) * 60000;
    if (this.banAll && this.environment.now() < this.banUntil)
      this.queue.fail('IPC is paused by a chat restriction.');
  }
  private receiveNotice(message: IpcServerMessage): void {
    const text = message.fields[0];
    if (typeof text !== 'string' || text.length > 512) return;
    const missing =
      /^(?:The player |Player |The user |User )?["']?(.+?)["']? is not on the system\.?$/i.exec(
        text,
      );
    if (missing) {
      const name = missing[1],
        target = this.recentMissingTarget(name);
      if (target) {
        this.forgetPeer(target);
        return;
      }
      if (/^(that player|the player|player|user)$/i.test(name)) {
        const unique = this.recentMissingTarget();
        if (unique) this.forgetPeer(unique);
      }
      return;
    }
    if (
      message.type === 'error' ||
      (typeof message.fields[1] === 'string' && message.fields[1].toLowerCase() === 'error')
    )
      this.pauseUntil = Math.max(this.pauseUntil, this.environment.now() + 3000);
  }
  private recentMissingTarget(name?: string): string | null {
    let found: string | null = null;
    for (const target of this.recentTargets) {
      if (
        this.environment.now() - target.time >= 5000 ||
        (name !== undefined && target.name.toLowerCase() !== name.toLowerCase())
      )
        continue;
      const peer = this.peers.get(target.id);
      if (
        !peer ||
        peer !== target.peer ||
        peer.sessionId !== target.token ||
        peer.seenVersion !== target.seenVersion ||
        peer.name !== target.name
      )
        continue;
      if (found !== null && found !== target.id) return null;
      found = target.id;
    }
    return found;
  }
  private forgetPeer(id: string, refresh = true): void {
    if (!this.peers.delete(id)) return;
    this.assembler.discardPeer(id, this.environment.now());
    this.queue.forgetPeer(id);
    if (refresh) this.requestDiscoveryRefresh();
  }

  private tick(): void {
    if (!this.current()) {
      if (ClientIpcService.singleton === this) ClientIpcService.shutdown();
      else this.dispose();
      return;
    }
    const now = this.environment.now();
    if (this.joining && now >= this.joinDeadline) this.lost('IPC initialization timed out.');
    else if (this.connection && !this.connection.connected) this.lost('IPC disconnected.');
    if (!this.joining && !this.connection && now >= this.retryAt) this.join();
    if (now >= this.nextSweep) {
      this.nextSweep = now + 1000;
      this.assembler.expire(now);
      this.queue.expire(now);
      const expired = [...this.peers.values()]
        .filter((peer) => !Number.isFinite(peer.lastSeen) || now - peer.lastSeen >= 150000)
        .map((peer) => peer.id);
      for (const id of expired) this.forgetPeer(id, false);
      if (this.connected && !this.paused)
        for (const peer of this.peers.values()) this.queueReply(peer);
    }
    if (!this.connected) return;
    this.announce();
    if (!this.paused) {
      this.queuePresence(now);
      this.queue.pump(now);
    }
  }
  private written(item: IpcQueueItem, peer: Peer | undefined, at: number, first: boolean): void {
    if (first)
      this.debugMessage(
        'OUT',
        item.targetChannel === 'broadcastLocal' ? 'local' : 'private',
        item.peerId,
        item.name,
        item.messageType,
        item.packTypes,
        item.frames.length,
      );
    if (item.targetChannel === 'peerMessage' && peer) {
      this.recentTargets.push({
        id: item.peerId!,
        name: item.name!,
        peer,
        token: peer.sessionId,
        seenVersion: peer.seenVersion,
        time: at,
      });
      if (this.recentTargets.length > 64) this.recentTargets.shift();
    }
  }
  private debugMessage(
    direction: string,
    channel: IpcChannel,
    id: string | null,
    name: string | null,
    type: string,
    packed?: string[],
    frames = 0,
  ): void {
    if (!this.debugEnabled) return;
    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let text = `[qipc3 ${direction}] ${channel === 'local' ? 'broadcastLocal' : 'peerMessage'}`;
    if (id !== null)
      text += `${direction === 'IN' ? ' from=' : ' to='}${escape(name || id)} (${escape(id)})`;
    text += ` type=${type}`;
    if (packed) text += `[${packed.length}]{${packed.join(',')}}`;
    if (frames > 0) text += ` frames=${frames}`;
    if (text.length > 900) text = text.slice(0, 897) + '...';
    try {
      this.environment.debug(text);
    } catch {
      /* Diagnostics cannot interrupt transport. */
    }
  }

  private quiesceForHostClose(): void {
    if (this.current()) {
      this.sendImmediateBye();
      this.stopTimer?.();
      this.stopTimer = null;
    }
  }
  private sendImmediateBye(): void {
    if (
      this.gracefulByeSent ||
      !this.running ||
      !this.initialized ||
      !this.connection?.connected ||
      !this.ownSessionId
    )
      return;
    this.gracefulByeSent = true;
    try {
      const frames = ClientIpcCodec.frames(
        { type: 'qipc3.ipc.bye', fields: [this.ownSessionId, this.ownLoginId] },
        this.nextId(),
      );
      if (frames.length !== 1 || frames[0].length > 150 || !ClientIpcCodec.parse(frames[0])) return;
      this.connection.send('chatMsg', 'local', frames[0]);
      this.debugMessage('OUT', 'local', null, null, 'qipc3.ipc.bye', undefined, 1);
    } catch {
      /* Presence expiry covers a lost best-effort leave. */
    }
  }
  private lost(reason: string): void {
    this.generation++;
    this.initialized = this.joining = false;
    this.detachSocket();
    this.peers.clear();
    this.assembler.clear();
    this.recentTargets = [];
    this.ownSessionId = null;
    this.helloPending = this.helloSent = this.presencePending = false;
    this.nextPresenceAt = 0;
    this.gracefulByeSent = false;
    this.retryAt =
      this.environment.now() + Math.min(30000, 1000 * 2 ** Math.min(this.retryCount++, 5));
    this.queue.fail(reason);
  }
  private detachSocket(): void {
    const previous = this.connection,
      message = this.messageHandler,
      disconnect = this.disconnectHandler;
    this.connection = null;
    this.messageHandler = this.disconnectHandler = null;
    if (!previous) return;
    this.environment.defer(() => {
      if (message)
        for (const type of ClientIpcService.types) previous.removeMessageHandler(type, message);
      if (disconnect) previous.removeDisconnectHandler(disconnect);
      this.close(previous);
    });
  }
  dispose(): void {
    this.sendImmediateBye();
    if (ClientIpcService.singleton === this) ClientIpcService.singleton = null;
    this.running = this.initialized = this.joining = false;
    this.generation++;
    this.stopTimer?.();
    this.stopTimer = null;
    this.detachSocket();
    this.peers.clear();
    this.assembler.clear();
    this.recentTargets = [];
    this.ownSessionId = null;
    this.presencePending = false;
    this.nextPresenceAt = 0;
    this.listeners.clear();
    this.peerHandlers.clear();
    this.client = null;
    const callbacks = [...this.disposeHandlers];
    this.disposeHandlers.clear();
    for (const callback of callbacks) {
      try {
        callback();
      } catch {
        /* Continue disposing other owners. */
      }
    }
    this.queue.fail('IPC authentication session ended.');
  }
  private nextId(): string {
    if (this.messageCounter >= 65536) {
      this.messageSeed = this.randomHex(8);
      this.messageCounter = 0;
    }
    return this.messageSeed + (this.messageCounter++).toString(16).padStart(4, '0');
  }
  private randomHex(length: number): string {
    let result = '';
    while (length-- > 0) result += Math.floor(this.environment.random() * 16).toString(16);
    return result;
  }
  private close(socket: IpcSocket | null): void {
    try {
      socket?.disconnect();
    } catch {
      /* Best effort on a dead socket. */
    }
  }
}
