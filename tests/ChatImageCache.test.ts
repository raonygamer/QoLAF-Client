import type { Texture } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatImageAsset } from '../src/chat/ChatImageAsset';
import { ChatImageCache, type ChatImageLoader } from '../src/chat/ChatImageCache';
import { ChatDiscordImageLink } from '../src/chat/ChatDiscordImageLink';

const link = (id: string) => ChatDiscordImageLink.parseAt(`https://example.test/${id}.png`, 0)!;
function asset(width = 100, height = 100, frameCount = 1, restore = true) {
  const frames = Array.from({ length: frameCount }, () => ({
    disposed: 0,
    dispose() {
      this.disposed++;
    },
  }));
  const bitmaps = restore
    ? frames.map(() => ({
        disposed: 0,
        dispose() {
          this.disposed++;
        },
      }))
    : [];
  return {
    frames: [...frames],
    bitmaps: [...bitmaps],
    value: new ChatImageAsset(frames as unknown as Texture[], [0, 40], width, height, bitmaps),
  };
}
function fixture() {
  const pending: {
    urls: string[];
    ok: (asset: ChatImageAsset) => void;
    fail: (reason: string) => void;
  }[] = [];
  let time = 0;
  const cache = new ChatImageCache(
    (): ChatImageLoader => ({
      loadCandidates(urls, ok, fail) {
        pending.push({ urls, ok, fail });
      },
    }),
    () => ++time,
  );
  return { cache, pending };
}

test('source image asset accounts for restoration pixels and disposes every frame once', () => {
  const image = asset(20, 30, 2);
  assert.equal(image.value.animated, true);
  assert.equal(image.value.estimatedBytes, 20 * 30 * 4 * 4);
  assert.equal(image.value.delayAt(-1), 20);
  assert.equal(image.value.delayAt(1.9), 40);
  assert.equal(image.value.delayAt(100), 40);
  image.value.dispose();
  image.value.dispose();
  assert.equal(image.value.frames.length, 0);
  assert.equal(image.value.delayAt(0), 100);
  for (const resource of [...image.frames, ...image.bitmaps]) assert.equal(resource.disposed, 1);
});

test('concurrent image requests share a load and reserve all references before callbacks', () => {
  const { cache, pending } = fixture();
  const oversized = asset(4096, 4096); // Two copies exceed the 96 MiB budget.
  const order: string[] = [];
  cache.prefetch(link('shared'));
  cache.acquire(
    link('shared'),
    (value) => {
      order.push('first');
      assert.equal(value.refCount, 2);
      cache.release(value);
      assert.equal(oversized.frames[0].disposed, 0);
    },
    null,
  );
  cache.acquire(
    link('shared'),
    (value) => {
      order.push('second');
      assert.equal(value.refCount, 1);
      assert.equal(value.frames.length, 1);
      cache.release(value);
    },
    null,
  );
  assert.equal(pending.length, 1);
  pending[0].ok(oversized.value);
  assert.deepEqual(order, ['first', 'second']);
  assert.equal(oversized.frames[0].disposed, 1);
  assert.equal(cache.cachedSize(link('shared')), null);
});

test('prefetch leaves a synchronous cached asset and normalized URL keys coalesce', () => {
  const { cache, pending } = fixture();
  const encoded = ChatDiscordImageLink.parseAt('https://example.test/a.png?a=b&amp;c=d', 0)!;
  const decoded = ChatDiscordImageLink.parseAt('https://example.test/a.png?a=b&c=d', 0)!;
  cache.prefetch(encoded);
  const image = asset();
  pending[0].ok(image.value);
  assert.equal(image.value.refCount, 0);
  let received = false;
  cache.acquire(
    decoded,
    (value) => {
      received = true;
      assert.equal(value, image.value);
    },
    null,
  );
  assert.equal(received, true);
  assert.equal(pending.length, 1);
  assert.equal(image.value.refCount, 1);
  const size = cache.cachedSize(decoded)!;
  size.width = 999;
  assert.equal(cache.cachedSize(decoded)?.width, 100);
  cache.release(image.value);
});

test('consumer exceptions preserve acquired ownership and failed loads can retry', () => {
  const { cache, pending } = fixture();
  const image = asset();
  let received = false;
  cache.acquire(
    link('a'),
    () => {
      throw Error('consumer');
    },
    null,
  );
  cache.acquire(
    link('a'),
    () => {
      received = true;
    },
    null,
  );
  assert.doesNotThrow(() => pending[0].ok(image.value));
  assert.equal(received, true);
  assert.equal(image.value.refCount, 2);
  cache.acquire(link('b'), null, () => {
    throw Error('failure consumer');
  });
  let failure = '';
  cache.acquire(link('b'), null, (reason) => (failure = reason));
  pending[1].fail('decode failed');
  assert.equal(failure, 'decode failed');
  cache.prefetch(link('b'));
  assert.equal(pending.length, 3);
  cache.acquire(null, null, (reason) => (failure = reason));
  assert.equal(failure, 'Invalid image URL.');
});

test('LRU eviction respects live references, entry count and refreshed last-use times', () => {
  const { cache, pending } = fixture();
  const images = Array.from({ length: 26 }, () => asset());
  for (let i = 0; i < 24; i++) {
    if (i === 0) cache.acquire(link(String(i)), () => {}, null);
    else cache.prefetch(link(String(i)));
    pending[i].ok(images[i].value);
  }
  // Touch entry 1, so unreferenced entry 2 is the oldest eviction candidate.
  cache.prefetch(link('1'));
  cache.prefetch(link('24'));
  pending[24].ok(images[24].value);
  assert.equal(images[0].frames[0].disposed, 0);
  assert.equal(images[1].frames[0].disposed, 0);
  assert.equal(images[2].frames[0].disposed, 1);
  assert.equal(cache.cachedSize(link('2')), null);
  cache.release(images[0].value);
  cache.prefetch(link('25'));
  pending[25].ok(images[25].value);
  assert.equal(images[0].frames[0].disposed, 0);
  assert.equal(images[3].frames[0].disposed, 1);
});

test('plugin unload cancels pending loads and disposes late assets without notifying removed views', () => {
  let complete!: (asset: ChatImageAsset) => void;
  let cancelled = 0,
    callbacks = 0;
  const cache = new ChatImageCache(() => ({
    loadCandidates(_urls, ok) {
      complete = ok;
    },
    cancel() {
      cancelled++;
    },
  }));
  cache.acquire(
    link('pending'),
    () => callbacks++,
    () => callbacks++,
  );
  cache.dispose();
  cache.dispose();
  assert.equal(cancelled, 1);
  const late = asset();
  complete(late.value);
  assert.equal(late.frames[0].disposed, 1);
  assert.equal(callbacks, 0);
  let reason = '';
  cache.acquire(link('next'), null, (value) => (reason = value));
  assert.equal(reason, 'Image cache is disposed.');
});
