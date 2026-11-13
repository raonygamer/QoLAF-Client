import { readNativeMessage } from './NativeMessage';
import type { Client, Connection, Message } from '../game/Bindings';
import type { IPCClient, IPCServerMessage, IPCSocket, IPCRoomData } from './ClientIPCService';

type MessageHandler = (message: IPCServerMessage) => void;

/** Typed adapter over the live Haxe PlayerIO wrappers; packet fields stay validated. */
export class NativeIPCClient implements IPCClient {
  constructor(private readonly native: Pick<Client, 'connectUserId' | 'multiplayer'>) {}
  get connectUserId(): string {
    return this.native.connectUserId;
  }
  createJoinRoom(
    roomId: string,
    roomType: string,
    visible: boolean,
    roomData: IPCRoomData,
    joinData: IPCRoomData,
    success: (socket: IPCSocket) => void,
    failure: (error: unknown) => void,
  ): void {
    this.native.multiplayer.createJoinRoom(
      roomId,
      roomType,
      visible,
      roomData,
      joinData,
      (socket: Connection) => success(new NativeIPCSocket(socket)),
      failure,
    );
  }
}

class NativeIPCSocket implements IPCSocket {
  private readonly handlers = new Map<string, Map<MessageHandler, (message: Message) => void>>();
  constructor(private readonly native: Connection) {}
  get connected(): boolean {
    return this.native.get_connected();
  }
  get roomId(): string {
    return this.native.get_roomId();
  }
  addMessageHandler(type: string, handler: MessageHandler): void {
    let handlers = this.handlers.get(type);
    if (!handlers) this.handlers.set(type, (handlers = new Map()));
    if (handlers.has(handler)) return;
    const wrapped = (message: Message) => {
      const decoded = readNativeMessage(message);
      if (decoded) handler(decoded);
    };
    handlers.set(handler, wrapped);
    this.native.addMessageHandler(type, wrapped);
  }
  removeMessageHandler(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type),
      wrapped = handlers?.get(handler);
    if (!handlers || !wrapped) return;
    this.native.removeMessageHandler(type, wrapped);
    handlers.delete(handler);
    if (handlers.size === 0) this.handlers.delete(type);
  }
  addDisconnectHandler(handler: () => void): void {
    this.native.addDisconnectHandler(handler);
  }
  removeDisconnectHandler(handler: () => void): void {
    this.native.removeDisconnectHandler(handler);
  }
  send(type: string, ...fields: string[]): void {
    this.native.send(type, ...fields);
  }
  disconnect(): void {
    this.native.disconnect();
  }
}
