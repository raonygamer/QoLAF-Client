import { ClientIPCCodec, type IPCMessage } from './ClientIPCCodec';

/** A pack is decoded completely before any child may be dispatched. */
export class ClientIPCMessagePack {
  static readonly type = 'qipc3.msgpk';
  static readonly maxMessages = 32;

  static create(serialized: Uint8Array[]): IPCMessage {
    if (!serialized || serialized.length < 2 || serialized.length > this.maxMessages)
      throw Error('Invalid QIPC3 message pack.');
    const message = { type: this.type, fields: serialized.map((bytes) => bytes.slice()) };
    if (!this.decode(message)) throw Error('Invalid QIPC3 message pack child.');
    return message;
  }

  static decode(message: IPCMessage): IPCMessage[] | null {
    if (
      !message ||
      message.type !== this.type ||
      message.fields.length < 2 ||
      message.fields.length > this.maxMessages
    )
      return null;
    const result: IPCMessage[] = [];
    let total = 0;
    try {
      for (const value of message.fields) {
        if (
          !(value instanceof Uint8Array) ||
          value.length < 1 ||
          value.length > ClientIPCCodec.maxBytes
        )
          return null;
        total += value.length;
        if (total > ClientIPCCodec.maxBytes) return null;
        const child = ClientIPCCodec.deserialize(value);
        if (child.type === this.type) return null;
        result.push(child);
      }
    } catch {
      return null;
    }
    return result;
  }
}
