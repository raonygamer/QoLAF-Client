import type { Texture } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatRemoteImageLoader, type ChatImagePlatform } from '../src/chat/ChatRemoteImageLoader';
import type { ChatImageAsset } from '../src/chat/ChatImageAsset';

function resource(width = 16, height = 16) {
  return {
    width,
    height,
    disposed: 0,
    dispose() {
      this.disposed++;
    },
  };
}
function fixture(overrides: Partial<ChatImagePlatform> = {}) {
  const bitmap = resource(),
    texture = resource();
  const urls: string[] = [];
  const platform: ChatImagePlatform = {
    async fetch(url) {
      urls.push(url);
      return new Response(new Uint8Array([1, 2, 3]));
    },
    async decodeStatic() {
      return bitmap;
    },
    beginGIF() {
      throw Error('unexpected GIF');
    },
    async nextFrame(signal) {
      signal.throwIfAborted();
    },
    upload() {
      return texture as unknown as Texture;
    },
    ...overrides,
  };
  const loader = new ChatRemoteImageLoader(platform);
  return { loader, bitmap, texture, urls };
}
function load(loader: ChatRemoteImageLoader, urls = ['https://example.test/a.png']) {
  return new Promise<ChatImageAsset>((resolve, reject) =>
    loader.loadCandidates(urls, resolve, (reason) => reject(Error(reason))),
  );
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('browser loader deduplicates candidates, falls back after errors, and transfers restoration ownership', async () => {
  const urls: string[] = [];
  const f = fixture({
    async fetch(url, options) {
      urls.push(url);
      assert.equal(options.credentials, 'omit');
      return url.endsWith('bad.png')
        ? new Response('bad', { status: 403 })
        : new Response(new Uint8Array([1]));
    },
  });
  const result = await load(f.loader, [
    'file:///bad.png',
    'https://x.test/bad.png',
    'https://x.test/bad.png',
    'https://x.test/good.png',
  ]);
  assert.deepEqual(urls, ['https://x.test/bad.png', 'https://x.test/good.png']);
  assert.equal(result.frames[0], f.texture);
  assert.equal(f.bitmap.disposed, 0);
  result.dispose();
  assert.equal(f.texture.disposed, 1);
  assert.equal(f.bitmap.disposed, 1);
});

test('response limits reject declared and streamed oversize bodies before decoding', async () => {
  let decoded = false;
  for (const response of [
    new Response(new Uint8Array([1]), { headers: { 'content-length': String(21 * 1024 * 1024) } }),
    new Response(new Uint8Array(20 * 1024 * 1024 + 1)),
    new Response(new Uint8Array()),
  ]) {
    const f = fixture({
      async fetch() {
        return response;
      },
      async decodeStatic() {
        decoded = true;
        return resource();
      },
    });
    await assert.rejects(load(f.loader), /too large/);
  }
  assert.equal(decoded, false);
});

test('failed dimensions or texture upload dispose decoded bitmaps', async () => {
  const oversized = resource(4097, 1);
  const f = fixture({
    async decodeStatic() {
      return oversized;
    },
  });
  await assert.rejects(load(f.loader), /dimensions/);
  assert.equal(oversized.disposed, 1);
  const g = fixture({
    upload() {
      throw Error('upload failed');
    },
  });
  await assert.rejects(load(g.loader), /upload failed/);
  assert.equal(g.bitmap.disposed, 1);
});

test('cancel suppresses callbacks and disposes a decoder result arriving late', async () => {
  let decoded!: (bitmap: ReturnType<typeof resource>) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => (started = resolve));
  const f = fixture({
    decodeStatic() {
      started();
      return new Promise((resolve) => (decoded = resolve));
    },
  });
  let callbacks = 0;
  f.loader.load(
    'https://x.test/a.png',
    () => callbacks++,
    () => callbacks++,
  );
  await ready;
  f.loader.cancel();
  decoded(f.bitmap);
  await flush();
  assert.equal(callbacks, 0);
  assert.equal(f.bitmap.disposed, 1);
  assert.equal(f.texture.disposed, 0);
});

test('20-second timeout advances to the next candidate even when fetch ignores abort', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0;
  const f = fixture({
    fetch() {
      requests++;
      return requests === 1
        ? new Promise(() => {})
        : Promise.resolve(new Response(new Uint8Array([1])));
    },
  });
  const result = load(f.loader, ['https://x.test/slow.png', 'https://x.test/next.png']);
  t.mock.timers.tick(20_000);
  const image = await result;
  assert.equal(requests, 2);
  image.dispose();
});

function gifHeader(width: number, height: number) {
  return new Uint8Array([
    71,
    73,
    70,
    56,
    57,
    97,
    width & 255,
    width >> 8,
    height & 255,
    height >> 8,
  ]);
}

test('animated GIF uploads yield between frames and dispose partial uploads on failure', async () => {
  const bitmaps = [resource(), resource()];
  const texture = resource();
  let index = 0,
    yielded = 0,
    disposed = 0;
  const f = fixture({
    async fetch() {
      return new Response(gifHeader(16, 16));
    },
    beginGIF() {
      return {
        width: 16,
        height: 16,
        get complete() {
          return index === 2;
        },
        nextFrame() {
          assert.equal(yielded, index + 1);
          return { bitmap: bitmaps[index++], delay: 70 };
        },
        dispose() {
          disposed++;
        },
      };
    },
    async nextFrame() {
      yielded++;
    },
    upload() {
      if (index === 2) throw Error('second frame upload');
      return texture as unknown as Texture;
    },
  });
  await assert.rejects(load(f.loader), /second frame upload/);
  assert.equal(disposed, 1);
  assert.equal(texture.disposed, 1);
  assert.deepEqual(
    bitmaps.map((bitmap) => bitmap.disposed),
    [1, 1],
  );
});

test('GIFs above source 60000-pixel animation threshold use static decoding', async () => {
  const f = fixture({
    async fetch() {
      return new Response(gifHeader(301, 200));
    },
  });
  const image = await load(f.loader);
  assert.equal(image.animated, false);
  image.dispose();
});
