import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatImageThumbnail } from '../src/ported/ChatImageThumbnail';
import { ChatImageCache } from '../src/chat/ChatImageCache';
import { ChatImageAsset } from '../src/chat/ChatImageAsset';
import { ChatDiscordImageLink } from '../src/chat/ChatDiscordImageLink';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';

function fixture() {
  const bitmap = bitmapRendererFixture('verdana48_bitmap');
  const pending: { ok: (asset: ChatImageAsset) => void; fail: (reason: string) => void }[] = [];
  let time = 0;
  const cache = new ChatImageCache(
    () => ({
      loadCandidates(_urls, ok, fail) {
        pending.push({ ok, fail });
      },
    }),
    () => time,
  );
  class Image extends bitmap.Sprite {
    constructor(public texture: any) {
      super();
    }
    readjustSize() {}
  }
  const resolve = (name: string): any =>
    name === 'starling.display.Image'
      ? Image
      : name === 'starling.text.TextField'
        ? Text
        : bitmap.resolve(name);
  const Thumbnail = createChatImageThumbnail(resolve, cache, () => time);
  const thumbnail = new Thumbnail();
  return {
    thumbnail,
    Thumbnail,
    cache,
    pending,
    tick(value: number) {
      time = value;
      thumbnail.dispatchEventWith('enterFrame');
    },
    cleanup() {
      thumbnail.dispose();
      cache.dispose();
      bitmap.cleanup();
    },
  };
}
const link = (name: string) => ChatDiscordImageLink.parseAt(`https://example.test/${name}.gif`, 0)!;
function asset(width: number, height: number, delays = [100]) {
  return new ChatImageAsset(
    delays.map((_, index) => ({ index, dispose() {} })),
    delays,
    width,
    height,
  );
}

test('thumbnail uses source placeholder, aspect ratio limits and synchronous cache geometry', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const view = f.thumbnail;
  let changes = 0;
  view.onPreviewSizeChanged = () => changes++;
  view.link = link('wide');
  assert.equal(view.previewWidth, 92);
  assert.equal(view.previewHeight, 16);
  assert.equal(view.children[0].text, '[Image loading]');
  const image = asset(1000, 400);
  f.pending[0].ok(image);
  assert.equal(view.previewWidth, 220);
  assert.equal(view.previewHeight, 88);
  assert.equal(view.children[1].scaleX, 0.22);
  assert.equal(view.children[0].visible, false);
  assert.equal(changes, 1);
  view.link = null;
  assert.equal(image.refCount, 0);
  view.link = link('wide');
  assert.equal(f.pending.length, 1);
  assert.equal(changes, 1); // Cache geometry is primed without re-invalidating parent.
  assert.equal(image.refCount, 1);
  view.link = link('tall');
  f.pending[1].ok(asset(40, 1000));
  assert.equal(view.previewWidth, 6);
  assert.equal(view.previewHeight, 140);
});

test('thumbnail releases stale results and ignores failures for recycled links', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  f.thumbnail.link = link('old');
  f.thumbnail.link = link('new');
  const old = asset(20, 20);
  f.pending[0].ok(old);
  assert.equal(old.refCount, 0);
  assert.equal(f.thumbnail.children.length, 1);
  f.pending[1].fail('network');
  assert.equal(f.thumbnail.children[0].text, '[Image unavailable]');
  assert.equal(f.thumbnail.previewWidth, 110);
  assert.equal(f.thumbnail.previewHeight, 16);
  f.thumbnail.link = link('late');
  f.thumbnail.dispose();
  const late = asset(10, 10);
  f.pending[2].ok(late);
  assert.equal(late.refCount, 0);
});

test('GIF playback follows source frame delays, bounded catch-up and stop lifecycle', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  f.thumbnail.link = link('animated');
  const image = asset(8, 8, [100, 20, 70, 100]);
  f.pending[0].ok(image);
  const node = f.thumbnail.children[1];
  assert.equal(f.thumbnail.previewWidth, 8); // Never upscale a small image.
  f.tick(99);
  assert.equal(node.texture.index, 0);
  f.tick(100);
  assert.equal(node.texture.index, 1);
  f.tick(120);
  assert.equal(node.texture.index, 2);
  f.tick(190);
  assert.equal(node.texture.index, 3);
  f.tick(290);
  assert.equal(node.texture.index, 0);
  f.tick(10_000);
  assert.equal(node.texture.index, 1); // Source guard: at most N+1 transitions.
  f.thumbnail.link = null;
  assert.equal(f.thumbnail.listeners('enterFrame').length, 0);
  assert.equal(image.refCount, 0);
  assert.equal(node.visible, false);
});

test('size callbacks may dispose the thumbnail during cache delivery', (t) => {
  const f = fixture();
  t.after(f.cleanup);
  f.thumbnail.onPreviewSizeChanged = () => f.thumbnail.dispose();
  f.thumbnail.link = link('reentrant');
  const image = asset(20, 20, [30, 30]);
  f.pending[0].ok(image);
  assert.equal(image.refCount, 0);
  assert.equal(f.thumbnail.listeners('enterFrame').length, 0);
  assert.equal(f.thumbnail.onPreviewSizeChanged, null);
});
