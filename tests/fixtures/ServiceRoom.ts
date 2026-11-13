import type { PlayerIOSDKConnection } from '../../src/game/PlayerIOSDKConnection';
import type { PlayerIOSDKMessage } from '../../src/game/PlayerIOMessageSerializer';
import type { Connection, Message } from '../../src/game/Bindings';
import { ServiceConnectionPool } from '../../src/service/ServiceConnectionPool';

export class Socket implements Connection {
  get __class__(): Connection['__class__'] {
    throw new Error('Class metadata is not used by this fixture');
  }

  readonly raw: PlayerIOSDKConnection;
  readonly messageHandlers: Connection['messageHandlers'] = [];
  get joinedRoomId() {
    return this.roomId;
  }
  get disconnectHandlers() {
    return this.disconnected;
  }
  get_connected() {
    return this.connected;
  }
  get_roomId() {
    return this.roomId;
  }
  createMessage(): Message {
    throw new Error('Message creation is not used by this fixture');
  }
  rawSend(message: PlayerIOSDKMessage) {
    this.raw.sendMessage(message);
  }
  sendMessage(message: Message) {
    this.sent.push([message]);
  }

  connected = true;
  disconnects = 0;
  sent: unknown[][] = [];
  send(...args: unknown[]) {
    this.sent.push(args);
  }
  messages = new Map<string, Function[]>();
  disconnected: Function[] = [];
  constructor(public roomId: string) {
    const socket = this;
    this.raw = {
      get connected() {
        return socket.connected;
      },
      sendMessage(message) {
        socket.sent.push([message]);
      },
    };
  }
  addMessageHandler(type: string, callback: (message: Message) => void) {
    this.messageHandlers.push({
      type,
      handler: callback,
      cb: () => {
        throw new Error('SDK message conversion is not used by this fixture');
      },
    });
    const list = this.messages.get(type) ?? [];
    list.push(callback);
    this.messages.set(type, list);
  }
  removeMessageHandler(type: string, callback: (message: Message) => void) {
    const registration = this.messageHandlers.findIndex(
      (entry) => entry.type === type && entry.handler === callback,
    );
    if (registration >= 0) this.messageHandlers.splice(registration, 1);
    const list = this.messages.get(type)!;
    const index = list.indexOf(callback);
    if (index >= 0) list.splice(index, 1);
  }
  addDisconnectHandler(callback: Function) {
    this.disconnected.push(callback);
  }
  removeDisconnectHandler(callback: Function) {
    const index = this.disconnected.indexOf(callback);
    if (index >= 0) this.disconnected.splice(index, 1);
  }
  emit(message: any) {
    for (const callback of this.messages.get(message.type) ?? []) callback(message);
  }
  disconnect() {
    this.disconnects++;
    this.connected = false;
    for (const callback of this.disconnected) callback();
  }
}
export function joined(id = 'self') {
  return {
    type: 'joined',
    length: 19,
    getString(index: number) {
      return index === 0 ? id : '';
    },
    getInt() {
      return 0;
    },
    getNumber() {
      return 0;
    },
  };
}
export function serviceFixture() {
  const joins: { id: string; data: any; ready: (socket: Socket) => void; failed: Function }[] = [];
  const pollers = new Set<() => void>();
  const deferred: (() => void)[] = [];
  let now = 0;
  const game: any = {
    client: {
      multiplayer: {
        joinRoom(id: string, data: any, ready: any, failed: any) {
          joins.push({ id, data, ready, failed });
        },
      },
    },
    me: { id: 'self' },
    isLeaving: false,
    get_isLeaving() {
      return this.isLeaving;
    },
    get_me() {
      return this.me;
    },
    get_connected() {
      return this.connected;
    },
    connected: true,
    serviceConnected: true,
    initialWorldIsRevealed: true,
    serviceConnection: new Socket('Service-1412_1'),
  };
  let current: any = game;
  const pool = new ServiceConnectionPool({
    currentGame: () => current,
    serverVersion: () => 1412,
    reservedRoom: () => 'Service-1412_999',
    reservedMessage: 'Reserved room',
    clientVersion: () => 1412,
    now: () => now,
    every: (_milliseconds, callback) => {
      pollers.add(callback);
      return () => pollers.delete(callback);
    },
    defer: (callback) => deferred.push(callback),
  });
  return {
    pool,
    game,
    joins,
    pollers,
    advance(milliseconds: number) {
      now += milliseconds;
      for (const poll of [...pollers]) poll();
    },
    flush() {
      while (deferred.length) deferred.shift()!();
    },
    replaceGame() {
      current = { serviceConnection: game.serviceConnection };
    },
  };
}
