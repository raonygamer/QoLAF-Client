/** ByteArray reads used by the source GIF decoder, over browser response bytes. */
export class GIFBytes {
  position = 0;
  constructor(private readonly data: Uint8Array) {}
  get length(): number {
    return this.data.length;
  }
  get bytesAvailable(): number {
    return this.length - this.position;
  }
  readUnsignedByte(): number {
    if (this.bytesAvailable <= 0) throw new Error('Truncated GIF.');
    return this.data[this.position++];
  }
  readUTFBytes(length: number): string {
    return String.fromCharCode(...this.read(length));
  }
  read(length: number): Uint8Array {
    if (length < 0 || length > this.bytesAvailable) throw new Error('Truncated GIF.');
    const result = this.data.subarray(this.position, this.position + length);
    this.position += length;
    return result;
  }
}
