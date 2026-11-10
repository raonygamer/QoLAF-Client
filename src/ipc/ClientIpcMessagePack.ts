import { ClientIpcCodec, type IpcMessage } from './ClientIpcCodec';

/** A pack is decoded completely before any child may be dispatched. */
export class ClientIpcMessagePack {
  static readonly type = 'qipc3.msgpk';
  static readonly maxMessages = 32;

  static create(serialized: Uint8Array[]): IpcMessage {
    if (!serialized || serialized.length < 2 || serialized.length > this.maxMessages)
      throw Error('Invalid QIPC3 message pack.');
    const message = { type: this.type, fields: serialized.map((bytes) => bytes.slice()) };
    if (!this.decode(message)) throw Error('Invalid QIPC3 message pack child.');
    return message;
  }

  static decode(message: IpcMessage): IpcMessage[] | null {
    if (
      !message ||
      message.type !== this.type ||
      message.fields.length < 2 ||
      message.fields.length > this.maxMessages
    )
      return null;
    const result: IpcMessage[] = [];
    let total = 0;
    try {
      for (const value of message.fields) {
        if (
          !(value instanceof Uint8Array) ||
          value.length < 1 ||
          value.length > ClientIpcCodec.maxBytes
        )
          return null;
        total += value.length;
        if (total > ClientIpcCodec.maxBytes) return null;
        const child = ClientIpcCodec.deserialize(value);
        if (child.type === this.type) return null;
        result.push(child);
      }
    } catch {
      return null;
    }
    return result;
  }
}
