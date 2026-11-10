export type IpcValue = string | number | boolean | Uint8Array;
export interface IpcMessage {
  type: string;
  fields: IpcValue[];
}
export type IpcFrame =
  | { kind: 's'; id: string; digest: string; data: string }
  | { kind: 'b'; id: string; digest: string; size: number; count: number }
  | { kind: 'p'; id: string; index: number; data: string }
  | { kind: 'e'; id: string };

/** Original QIPC3 framing and canonical PlayerIO primitive wire grammar. */
export class ClientIpcCodec {
  static readonly prefix = 'qipc3.';
  static readonly packetVersion = 3;
  static readonly maxBytes = 65536;
  static readonly maxFields = 512;
  static readonly partChars = 125;
  static readonly maxParts = 700;
  private static readonly alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  static validId(value: string): boolean {
    return typeof value === 'string' && value.length === 12 && /^[0-9a-f]{12}$/.test(value);
  }

  static frames(message: IpcMessage, id: string): string[] {
    return this.framesSerialized(this.serialize(message), id);
  }

  static framesSerialized(bytes: Uint8Array, id: string): string[] {
    if (!this.validId(id)) throw Error('Invalid IPC message ID.');
    if (!bytes || bytes.length < 1 || bytes.length > this.maxBytes)
      throw Error('Invalid IPC bytes.');
    const encoded = this.encode(bytes);
    const digest = this.checksum(bytes);
    const single = `${this.prefix}s.${id}.${digest}.${encoded}`;
    if (single.length <= 150) return [single];
    const count = Math.ceil(encoded.length / this.partChars);
    if (count > this.maxParts) throw Error('IPC message is too large.');
    const result = [`${this.prefix}b.${id}.${bytes.length}.${count}.${digest}`];
    for (let index = 0; index < count; index++)
      result.push(
        `${this.prefix}p.${id}.${index}.${encoded.slice(index * this.partChars, (index + 1) * this.partChars)}`,
      );
    result.push(`${this.prefix}e.${id}`);
    return result;
  }

  static parse(text: string): IpcFrame | null {
    if (
      typeof text !== 'string' ||
      text.length > 150 ||
      text.length < 20 ||
      /[^A-Za-z0-9_.-]/.test(text) ||
      !/^qipc3\.[sbpe]\.[0-9a-f]{12}(\.[A-Za-z0-9_-]+)*$/.test(text)
    )
      return null;
    const fields = text.split('.');
    const kind = fields[1],
      id = fields[2];
    const decimal = (value: string) => /^(0|[1-9][0-9]{0,5})$/.test(value);
    const digest = (value: string) => /^[0-9a-f]{8}$/.test(value);
    if (kind === 'e') return fields.length === 3 ? { kind, id } : null;
    if (kind === 's')
      return fields.length === 5 && digest(fields[3])
        ? { kind, id, digest: fields[3], data: fields[4] }
        : null;
    if (kind === 'p')
      return fields.length === 5 &&
        decimal(fields[3]) &&
        Number(fields[3]) < this.maxParts &&
        fields[4].length <= this.partChars
        ? { kind, id, index: Number(fields[3]), data: fields[4] }
        : null;
    if (fields.length !== 6 || !decimal(fields[3]) || !decimal(fields[4]) || !digest(fields[5]))
      return null;
    const size = Number(fields[3]),
      count = Number(fields[4]);
    if (
      size < 1 ||
      size > this.maxBytes ||
      count < 1 ||
      count > this.maxParts ||
      count !== Math.ceil(Math.ceil((size * 4) / 3) / this.partChars)
    )
      return null;
    return { kind: 'b', id, size, count, digest: fields[5] };
  }

  static serialize(message: IpcMessage): Uint8Array {
    if (
      !message ||
      !this.validType(message.type) ||
      !Array.isArray(message.fields) ||
      message.fields.length > this.maxFields
    )
      throw Error('Invalid IPC message.');
    const output: number[] = [];
    // SDK SerializeMessage writes field count, type, then each primitive.
    this.writeToken(output, message.fields.length + 1);
    this.writeToken(output, message.type);
    this.writeToken(output, this.packetVersion);
    for (const value of message.fields) {
      this.writeToken(output, value);
      if (output.length > this.maxBytes) throw Error('IPC message is too large.');
    }
    return Uint8Array.from(output);
  }

  static deserialize(bytes: Uint8Array): IpcMessage {
    if (!bytes || bytes.length < 2 || bytes.length > this.maxBytes)
      throw Error('Invalid IPC bytes.');
    const reader = new IpcTokenReader(bytes);
    const count = reader.read();
    if (
      typeof count !== 'number' ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > this.maxFields + 1
    )
      throw Error('Invalid IPC field count.');
    const type = reader.read();
    if (typeof type !== 'string' || !this.validType(type)) throw Error('Invalid IPC type.');
    if (reader.read() !== this.packetVersion) throw Error('Unsupported IPC packet version.');
    const fields: IpcValue[] = [];
    for (let index = 1; index < count; index++) fields.push(reader.read());
    if (!reader.finished) throw Error('Trailing IPC bytes.');
    const message = { type, fields };
    const canonical = this.serialize(message);
    if (canonical.length !== bytes.length || canonical.some((byte, index) => byte !== bytes[index]))
      throw Error('Noncanonical IPC bytes.');
    return message;
  }

  private static validType(type: string): boolean {
    return (
      typeof type === 'string' &&
      type.startsWith(this.prefix) &&
      !/[^A-Za-z0-9_.-]/.test(type) &&
      /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(type)
    );
  }

  private static writeToken(output: number[], value: IpcValue): void {
    const header = (tag: number, number: number) => {
      const bytes = [number >>> 24, (number >>> 16) & 255, (number >>> 8) & 255, number & 255];
      while (bytes.length > 1 && bytes[0] === 0) bytes.shift();
      output.push(tag | (bytes.length - 1), ...bytes);
    };
    if (typeof value === 'boolean') {
      output.push(value ? 1 : 0);
      return;
    }
    if (typeof value === 'string' || value instanceof Uint8Array) {
      if (value.length > this.maxBytes) throw Error('IPC field is too large.');
      const string = typeof value === 'string';
      const bytes = string ? new TextEncoder().encode(value) : value;
      if (bytes.length > this.maxBytes) throw Error('IPC field is too large.');
      if (bytes.length < 64) output.push((string ? 192 : 64) | bytes.length);
      else header(string ? 12 : 16, bytes.length);
      for (const byte of bytes) output.push(byte);
      return;
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw Error('Invalid IPC field type or number.');
    // The Flash SDK tries signed int, uint, float, then double, in that order.
    if ((value | 0) === value) {
      if (value >= 0 && value < 64) output.push(128 | value);
      else header(4, value >>> 0);
    } else if (value >>> 0 === value) header(8, value);
    else {
      const float = Math.fround(value) === value;
      const buffer = new ArrayBuffer(float ? 4 : 8);
      const view = new DataView(buffer);
      if (float) view.setFloat32(0, value);
      else view.setFloat64(0, value);
      output.push(float ? 2 : 3, ...new Uint8Array(buffer));
    }
  }

  static encode(bytes: Uint8Array): string {
    if (!bytes || bytes.length > this.maxBytes) throw Error('Invalid IPC bytes.');
    const result: string[] = [];
    for (let index = 0; index < bytes.length; index += 3) {
      const a = bytes[index],
        b = bytes[index + 1] ?? 0,
        c = bytes[index + 2] ?? 0;
      let part = this.alphabet[a >> 2] + this.alphabet[((a & 3) << 4) | (b >> 4)];
      if (index + 1 < bytes.length) part += this.alphabet[((b & 15) << 2) | (c >> 6)];
      if (index + 2 < bytes.length) part += this.alphabet[c & 63];
      result.push(part);
    }
    return result.join('');
  }

  static decode(encoded: string): Uint8Array {
    if (
      typeof encoded !== 'string' ||
      encoded.length < 1 ||
      encoded.length > Math.ceil((this.maxBytes * 4) / 3) ||
      encoded.length % 4 === 1 ||
      /[^A-Za-z0-9_-]/.test(encoded)
    )
      throw Error('Invalid IPC base64url.');
    const output: number[] = [];
    let bits = 0,
      accumulator = 0;
    for (const character of encoded) {
      accumulator = (accumulator << 6) | this.alphabet.indexOf(character);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output.push((accumulator >> bits) & 255);
      }
    }
    const bytes = Uint8Array.from(output);
    if (bytes.length > this.maxBytes || this.encode(bytes) !== encoded)
      throw Error('Noncanonical IPC base64url.');
    return bytes;
  }

  static checksum(bytes: Uint8Array): string {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
  }
}

/** Bounded parser, rejecting SDK aliases before canonical reserialization. */
class IpcTokenReader {
  private position = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get finished(): boolean {
    return this.position === this.bytes.length;
  }
  private require(count: number): void {
    if (count > ClientIpcCodec.maxBytes || count > this.bytes.length - this.position)
      throw Error('Truncated IPC token.');
  }
  private unsigned(count: number): number {
    this.require(count);
    let value = 0;
    while (count-- > 0) value = (value << 8) | this.bytes[this.position++];
    return value >>> 0;
  }
  read(): IpcValue {
    const tag = this.unsigned(1);
    let length: number,
      string = false;
    if (tag >= 192) {
      length = tag & 63;
      string = true;
    } else if (tag >= 128) return tag & 63;
    else if (tag >= 64) length = tag & 63;
    else if (tag >= 4 && tag <= 11) {
      const value = this.unsigned((tag & 3) + 1);
      return tag < 8 ? value | 0 : value;
    } else if (tag >= 12 && tag <= 19) {
      length = this.unsigned((tag & 3) + 1);
      string = tag < 16;
    } else if (tag === 2 || tag === 3) {
      const count = tag === 2 ? 4 : 8;
      this.require(count);
      const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.position, count);
      const value = tag === 2 ? view.getFloat32(0) : view.getFloat64(0);
      this.position += count;
      if (!Number.isFinite(value)) throw Error('Nonfinite IPC number.');
      return value;
    } else if (tag <= 1) return tag === 1;
    else throw Error('Unsupported IPC token.');
    this.require(length);
    const bytes = this.bytes.slice(this.position, this.position + length);
    this.position += length;
    // Keep a leading UTF-8 BOM as payload, matching ByteArray.readUTFBytes.
    return string
      ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      : bytes;
  }
}
