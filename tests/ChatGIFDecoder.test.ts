import { bindGameClasses } from '../src/game/Bindings';
import type { BitmapData } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ChatGIFDecoder } from '../src/chat/ChatGIFDecoder';
import { GIFBytes } from '../src/chat/GIFBytes';
import { createChatGIFDecodeTask } from '../src/ported/ChatGIFDecodeTask';

class Bitmap {
  static created: Bitmap[] = [];
  pixels: Uint32Array;
  disposed = 0;
  constructor(
    readonly width: number,
    readonly height: number,
    _transparent = true,
    fill = 0,
  ) {
    this.pixels = new Uint32Array(width * height).fill(fill);
    Bitmap.created.push(this);
  }
  setPixel32(x: number, y: number, color: number) {
    this.pixels[y * this.width + x] = color;
  }
  clone() {
    const result = new Bitmap(this.width, this.height);
    result.pixels.set(this.pixels);
    return result;
  }
  fillRect(rect: Rectangle, color: number) {
    for (let y = Math.max(0, rect.y); y < Math.min(this.height, rect.y + rect.height); y++)
      for (let x = Math.max(0, rect.x); x < Math.min(this.width, rect.x + rect.width); x++)
        this.setPixel32(x, y, color);
  }
  dispose() {
    this.disposed++;
  }
}
class Rectangle {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly width: number,
    readonly height: number,
  ) {}
}
bindGameClasses({
  cls: (name: string) =>
    name === 'openfl.display.BitmapData'
      ? Bitmap
      : name === 'openfl.geom.Rectangle'
        ? Rectangle
        : {},
} as unknown as API);
const Task = createChatGIFDecodeTask();
function fixture(name: string) {
  return JSON.parse(readFileSync(new URL(`./fixtures/gif/${name}.json`, import.meta.url), 'utf8'));
}
function hash(native: BitmapData): string {
  assert.ok(native instanceof Bitmap);
  const bitmap = native;
  const bytes = new Uint8Array(bitmap.pixels.length * 4);
  bitmap.pixels.forEach((argb, index) =>
    bytes.set([(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, argb >>> 24], index * 4),
  );
  return createHash('sha256').update(bytes).digest('hex');
}
for (const name of ['Disposal', 'Interlaced'])
  test(`incremental GIF pixels match independent Pillow decode: ${name}`, () => {
    const source = fixture(name);
    const task = new Task(new GIFBytes(Buffer.from(source.gif, 'base64')));
    assert.equal(task.width, source.width);
    assert.equal(task.height, source.height);
    let count = 0;
    while (!task.complete) {
      const frame = task.nextFrame();
      if (!frame) continue;
      assert.equal(hash(frame.bitmap), source.frames[count].sha256, `frame ${count}`);
      const delay = source.frames[count].delay;
      assert.equal(frame.delay, delay <= 10 ? 100 : Math.max(20, delay));
      count++;
      frame.bitmap.dispose();
    }
    assert.equal(count, source.frames.length);
    assert.equal(task.nextFrame(), null);
    task.dispose();
    task.dispose();
  });

test('GIF guards reject invalid headers, oversized canvases and truncated palettes', () => {
  const source = Buffer.from(fixture('Disposal').gif, 'base64');
  assert.throws(() => new Task(new GIFBytes(new Uint8Array())), /Invalid GIF/);
  const badHeader = Buffer.from(source);
  badHeader[0] = 0;
  assert.throws(() => new Task(new GIFBytes(badHeader)), /Not a GIF/);
  const oversized = Buffer.from(source);
  oversized[6] = 255;
  oversized[7] = 255;
  assert.throws(() => new Task(new GIFBytes(oversized)), /dimensions/);
  assert.throws(() => new Task(new GIFBytes(source.subarray(0, 20))), /palette/);
  const task = new Task(new GIFBytes(source));
  task.dispose();
  assert.equal(task.nextFrame(), null);
  assert.equal(task.complete, true);
});

test('synchronous facade releases partial frames on failure and leaves successful frames owned by caller', () => {
  const decoder = new ChatGIFDecoder();
  const bytes = Buffer.from(fixture('Disposal').gif, 'base64');
  Bitmap.created = [];
  const result = decoder.decode(bytes);
  assert.equal(result.frames.length, 4);
  for (const frame of result.frames) {
    assert.ok(frame instanceof Bitmap);
    assert.equal(frame.disposed, 0);
    frame.dispose();
  }
  assert.ok(Bitmap.created.every((bitmap) => bitmap.disposed === 1));
  const broken = Buffer.from(bytes);
  assert.equal(broken[broken.length - 1], 0x3b);
  broken[broken.length - 1] = 0;
  Bitmap.created = [];
  assert.throws(() => decoder.decode(broken), /Unsupported GIF block/);
  assert.ok(Bitmap.created.length > 4);
  assert.ok(Bitmap.created.every((bitmap) => bitmap.disposed === 1));
});
