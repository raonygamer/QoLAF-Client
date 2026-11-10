import { readNativeMessage } from './NativeMessage';
import { read, type Raw } from '../api/Types';
import type { IpcClient, IpcServerMessage, IpcSocket } from './ClientIpcService';

type MessageHandler = (message: IpcServerMessage) => void;

/** The only dynamic boundary: inspected Haxe PlayerIO wrappers and SDK payloads. */
export class NativeIpcClient implements IpcClient {
  constructor(private readonly native: Raw) {}
  get connectUserId(): string {
    return this.native.connectUserId;
  }
  createJoinRoom(
    roomId: string,
    roomType: string,
    visible: boolean,
    roomData: Record<string, unknown>,
    joinData: Record<string, unknown>,
    success: (socket: IpcSocket) => void,
    failure: (error: unknown) => void,
  ): void {
    this.native.multiplayer.createJoinRoom(
      roomId,
      roomType,
      visible,
      roomData,
      joinData,
      (socket: Raw) => success(new NativeIpcSocket(socket)),
      failure,
    );
  }
}

class NativeIpcSocket implements IpcSocket {
  private readonly handlers = new Map<string, Map<MessageHandler, (message: Raw) => void>>();
  constructor(private readonly native: Raw) {}
  get connected(): boolean {
    return read(this.native, 'connected', false);
  }
  get roomId(): string {
    return read(this.native, 'roomId', '');
  }
  addMessageHandler(type: string, handler: MessageHandler): void {
    let handlers = this.handlers.get(type);
    if (!handlers) this.handlers.set(type, (handlers = new Map()));
    if (handlers.has(handler)) return;
    const wrapped = (message: Raw) => {
      const decoded = readNativeMessage(message);
      if (decoded) handler(decoded);
    };
    handlers.set(handler, wrapped);
    this.native.addMessageHandler(type, wrapped);
  }
  removeMessageHandler(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type),
      wrapped = handlers?.get(handler);
    if (!wrapped) return;
    this.native.removeMessageHandler(type, wrapped);
    handlers!.delete(handler);
    if (handlers!.size === 0) this.handlers.delete(type);
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
