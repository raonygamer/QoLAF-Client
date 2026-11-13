// Source port of core/hud/components/chat/ChatGIFDecodeTask.as.
import { BitmapData, Rectangle } from '../game/Bindings';
import { GIFBytes } from '../chat/GIFBytes';
export function createChatGIFDecodeTask() {
  /**
   * Incremental GIF87a/GIF89a decoder.
   *
   * nextFrame() decodes at most one composited frame so callers may yield to the
   * Starling frame loop between expensive LZW/compositing/upload work.
   */

  class ChatGIFDecodeTask {
    private static MAX_DIMENSION: number = 2048;
    private static MAX_CANVAS_PIXELS: number = 1500000;
    private static MAX_FRAMES: number = 180;
    private static MAX_FRAME_PIXELS: number = 32000000;

    private bytes: GIFBytes;
    private canvas: BitmapData | null = null;
    private globalTable: number[] | null = null;
    private screenWidth: number = 0;
    private screenHeight: number = 0;
    private delayCs: number = 10;
    private transparentIndex: number = -1;
    private disposal: number = 0;
    private frameCount: number = 0;
    private _complete: boolean = false;
    private disposed: boolean = false;

    constructor(source: GIFBytes) {
      if (source == null || source.length < 13) {
        throw new Error('Invalid GIF.');
      }
      this.bytes = source;
      this.bytes.position = 0;
      let header: string = this.bytes.readUTFBytes(6);
      if (header != 'GIF87a' && header != 'GIF89a') {
        throw new Error('Not a GIF.');
      }
      this.screenWidth = ChatGIFDecodeTask.readU16(this.bytes);
      this.screenHeight = ChatGIFDecodeTask.readU16(this.bytes);
      if (
        this.screenWidth <= 0 ||
        this.screenHeight <= 0 ||
        this.screenWidth > ChatGIFDecodeTask.MAX_DIMENSION ||
        this.screenHeight > ChatGIFDecodeTask.MAX_DIMENSION ||
        Number(this.screenWidth) * Number(this.screenHeight) > ChatGIFDecodeTask.MAX_CANVAS_PIXELS
      ) {
        throw new Error('GIF dimensions are unsupported.');
      }
      let packed: number = this.bytes.readUnsignedByte();
      let globalFlag: boolean = (packed & 0x80) != 0;
      let globalSize: number = 1 << ((packed & 7) + 1);
      this.bytes.readUnsignedByte(); // background index
      this.bytes.readUnsignedByte(); // pixel aspect
      this.globalTable = globalFlag
        ? ChatGIFDecodeTask.readColorTable(this.bytes, globalSize)
        : null;
      this.canvas = new BitmapData(this.screenWidth, this.screenHeight, true, 0x00000000);
    }

    public get width(): number {
      return this.screenWidth;
    }
    public get height(): number {
      return this.screenHeight;
    }
    public get complete(): boolean {
      return this._complete;
    }

    /**
     * Returns {bitmap:BitmapData, delay:int} for the next frame, or null when
     * the stream has completed. The caller owns and must dispose the bitmap.
     */

    public nextFrame(): { bitmap: BitmapData; delay: number } | null {
      if (this.disposed || this._complete || !this.canvas) return null;
      while (this.bytes != null && this.bytes.bytesAvailable > 0) {
        let marker: number = this.bytes.readUnsignedByte();
        if (marker == 0x3b) {
          this._complete = true;
          return null;
        }
        if (marker == 0x21) {
          this.readExtension();
          continue;
        }
        if (marker != 0x2c) {
          throw new Error('Unsupported GIF block.');
        }

        let left: number = ChatGIFDecodeTask.readU16(this.bytes);
        let top: number = ChatGIFDecodeTask.readU16(this.bytes);
        let frameWidth: number = ChatGIFDecodeTask.readU16(this.bytes);
        let frameHeight: number = ChatGIFDecodeTask.readU16(this.bytes);
        let framePixels: number = Number(frameWidth) * Number(frameHeight);
        if (
          frameWidth <= 0 ||
          frameHeight <= 0 ||
          frameWidth > ChatGIFDecodeTask.MAX_DIMENSION ||
          frameHeight > ChatGIFDecodeTask.MAX_DIMENSION ||
          framePixels > ChatGIFDecodeTask.MAX_CANVAS_PIXELS
        ) {
          throw new Error('GIF frame dimensions are unsupported.');
        }
        if (
          this.frameCount >= ChatGIFDecodeTask.MAX_FRAMES ||
          Number(this.frameCount + 1) * this.screenWidth * this.screenHeight >
            ChatGIFDecodeTask.MAX_FRAME_PIXELS
        ) {
          throw new Error('GIF animation is too large.');
        }
        let imagePacked: number = this.bytes.readUnsignedByte();
        let localFlag: boolean = (imagePacked & 0x80) != 0;
        let interlaced: boolean = (imagePacked & 0x40) != 0;
        let localSize: number = 1 << ((imagePacked & 7) + 1);
        let table: number[] | null = localFlag
          ? ChatGIFDecodeTask.readColorTable(this.bytes, localSize)
          : this.globalTable;
        if (table == null) throw new Error('GIF has no color table.');
        if (this.bytes.bytesAvailable <= 0) throw new Error('Truncated GIF.');
        let minimumCodeSize: number = this.bytes.readUnsignedByte();
        let compressed: GIFBytes = ChatGIFDecodeTask.readSubBlocks(this.bytes);
        let indices: number[] = ChatGIFDecodeTask.decodeLzw(
          compressed,
          minimumCodeSize,
          Number(framePixels),
        );

        let before: BitmapData | null = this.disposal == 3 ? this.canvas.clone() : null;
        ChatGIFDecodeTask.drawIndices(
          this.canvas,
          indices,
          table,
          this.transparentIndex,
          left,
          top,
          frameWidth,
          frameHeight,
          interlaced,
        );
        let rendered: BitmapData = this.canvas.clone();
        let frameDelay: number = this.delayCs <= 1 ? 100 : Math.max(20, this.delayCs * 10);
        this.frameCount++;

        if (this.disposal == 2) {
          this.canvas.fillRect(new Rectangle(left, top, frameWidth, frameHeight), 0x00000000);
        } else if (this.disposal == 3 && before != null) {
          this.canvas.dispose();
          this.canvas = before;
          before = null;
        }
        if (before != null) before.dispose();
        this.delayCs = 10;
        this.transparentIndex = -1;
        this.disposal = 0;
        return { bitmap: rendered, delay: frameDelay };
      }
      this._complete = true;
      return null;
    }

    private readExtension(): void {
      if (this.bytes.bytesAvailable <= 0) {
        this._complete = true;
        return;
      }
      let label: number = this.bytes.readUnsignedByte();
      if (label == 0xf9) {
        let blockSize: number = this.bytes.readUnsignedByte();
        if (blockSize < 4 || this.bytes.bytesAvailable < blockSize) {
          throw new Error('Broken GIF control block.');
        }
        let control: number = this.bytes.readUnsignedByte();
        this.delayCs = ChatGIFDecodeTask.readU16(this.bytes);
        let trans: number = this.bytes.readUnsignedByte();
        this.transparentIndex = (control & 1) != 0 ? trans : -1;
        this.disposal = (control >> 2) & 7;
        for (let extra: number = 4; extra < blockSize; extra++) {
          this.bytes.readUnsignedByte();
        }
        if (this.bytes.bytesAvailable > 0) this.bytes.readUnsignedByte();
      } else if (label == 0xff || label == 0x01) {
        ChatGIFDecodeTask.skipSubBlocks(this.bytes, true);
      } else {
        ChatGIFDecodeTask.skipSubBlocks(this.bytes, false);
      }
    }

    private static readU16(source: GIFBytes): number {
      if (source.bytesAvailable < 2) throw new Error('Truncated GIF.');
      return source.readUnsignedByte() | (source.readUnsignedByte() << 8);
    }

    private static readColorTable(source: GIFBytes, size: number): number[] {
      let result: number[] = [];
      for (let i: number = 0; i < size; i++) {
        if (source.bytesAvailable < 3) {
          throw new Error('Truncated GIF palette.');
        }
        let r: number = source.readUnsignedByte();
        let g: number = source.readUnsignedByte();
        let b: number = source.readUnsignedByte();
        result[i] = 0xff000000 | (r << 16) | (g << 8) | b;
      }
      return result;
    }

    private static skipSubBlocks(source: GIFBytes, hasHeader: boolean = false): void {
      if (hasHeader) {
        if (source.bytesAvailable <= 0) return;
        let headerSize: number = source.readUnsignedByte();
        if (headerSize > source.bytesAvailable) {
          throw new Error('Truncated GIF extension.');
        }
        source.position += headerSize;
      }
      while (source.bytesAvailable > 0) {
        let length: number = source.readUnsignedByte();
        if (length == 0) return;
        if (length > source.bytesAvailable) {
          throw new Error('Truncated GIF sub-block.');
        }
        source.position += length;
      }
    }

    private static readSubBlocks(source: GIFBytes): GIFBytes {
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (source.bytesAvailable > 0) {
        const length = source.readUnsignedByte();
        if (length === 0) break;
        if (length > source.bytesAvailable) throw new Error('Truncated GIF data.');
        chunks.push(source.read(length));
        size += length;
      }
      const data = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      return new GIFBytes(data);
    }

    private static decodeLzw(
      data: GIFBytes,
      minimumCodeSize: number,
      pixelCount: number,
    ): number[] {
      if (minimumCodeSize < 2 || minimumCodeSize > 8) {
        throw new Error('Unsupported GIF LZW size.');
      }
      let clearCode: number = 1 << minimumCodeSize;
      let endCode: number = clearCode + 1;
      let available: number = clearCode + 2;
      let oldCode: number = -1;
      let codeSize: number = minimumCodeSize + 1;
      let codeMask: number = (1 << codeSize) - 1;
      const prefix: number[] = new Array(4096).fill(0);
      const suffix: number[] = new Array(4096).fill(0);
      const stack: number[] = new Array(4097).fill(0);
      const output: number[] = new Array(pixelCount).fill(0);
      for (let i: number = 0; i < clearCode; i++) suffix[i] = i;

      let datum: number = 0;
      let bits: number = 0;
      let top: number = 0;
      let out: number = 0;
      let first: number = 0;
      data.position = 0;
      while (out < pixelCount) {
        if (top == 0) {
          while (bits < codeSize && data.bytesAvailable > 0) {
            datum |= data.readUnsignedByte() << bits;
            bits += 8;
          }
          if (bits < codeSize) break;
          let code: number = datum & codeMask;
          datum >>= codeSize;
          bits -= codeSize;

          if (code == clearCode) {
            codeSize = minimumCodeSize + 1;
            codeMask = (1 << codeSize) - 1;
            available = clearCode + 2;
            oldCode = -1;
            continue;
          }
          if (code == endCode) break;
          if (code > available || code >= 4096) break;
          if (oldCode == -1) {
            if (code >= clearCode) break;
            output[out++] = suffix[code];
            first = suffix[code];
            oldCode = code;
            continue;
          }

          let inCode: number = code;
          if (code == available) {
            stack[top++] = first;
            code = oldCode;
          }
          while (code >= clearCode + 2 && code < 4096) {
            stack[top++] = suffix[code];
            code = prefix[code];
            if (top >= stack.length - 1) break;
          }
          if (code >= clearCode) break;
          first = suffix[code];
          stack[top++] = first;

          if (available < 4096) {
            prefix[available] = oldCode;
            suffix[available] = first;
            available++;
            if (available == 1 << codeSize && codeSize < 12) {
              codeSize++;
              codeMask = (1 << codeSize) - 1;
            }
          }
          oldCode = inCode;
        }
        if (top > 0) output[out++] = stack[--top];
      }
      return output;
    }

    private static drawIndices(
      target: BitmapData,
      indices: number[],
      table: number[],
      transparent: number,
      left: number,
      top: number,
      width: number,
      height: number,
      interlaced: boolean,
    ): void {
      let source: number = 0;
      if (!interlaced) {
        for (let y: number = 0; y < height; y++) {
          source = ChatGIFDecodeTask.drawRow(
            target,
            indices,
            source,
            table,
            transparent,
            left,
            top + y,
            width,
          );
        }
        return;
      }
      const starts: number[] = [0, 4, 2, 1];
      const steps: number[] = [8, 8, 4, 2];
      for (let pass: number = 0; pass < 4; pass++) {
        for (let y = Number(starts[pass]); y < height; y += Number(steps[pass])) {
          source = ChatGIFDecodeTask.drawRow(
            target,
            indices,
            source,
            table,
            transparent,
            left,
            top + y,
            width,
          );
        }
      }
    }

    private static drawRow(
      target: BitmapData,
      indices: number[],
      source: number,
      table: number[],
      transparent: number,
      left: number,
      y: number,
      width: number,
    ): number {
      for (let x: number = 0; x < width; x++) {
        if (source >= indices.length) return source;
        let index: number = indices[source++];
        if (index == transparent || index < 0 || index >= table.length) continue;
        let px: number = left + x;
        if (px < 0 || y < 0 || px >= target.width || y >= target.height) continue;
        target.setPixel32(px, y, table[index]);
      }
      return source;
    }

    public dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      this._complete = true;
      if (this.canvas != null) {
        this.canvas.dispose();
        this.canvas = null;
      }
      this.globalTable = null;
      this.bytes = new GIFBytes(new Uint8Array());
    }
  }

  return ChatGIFDecodeTask;
}
