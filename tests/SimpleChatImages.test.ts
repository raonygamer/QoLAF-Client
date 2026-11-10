import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimpleChatImages } from '../src/chat/SimpleChatImages';
import { ChatImageCache } from '../src/chat/ChatImageCache';
import { ChatImageAsset } from '../src/chat/ChatImageAsset';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';

test('Simple image spacers use font metrics, preserve suffixes, reflow and release expired rows', (t) => {
  const bitmap = bitmapRendererFixture('verdana48_bitmap');
  const resolve = (name: string): any =>
    name === 'starling.text.TextField' ? Text : bitmap.resolve(name);
  const Renderer = resolve('core.hud.components.chat.rich.RichBitmapFontTextRenderer');
  const Format = resolve('feathers.text.BitmapFontTextFormat');
  const renderer = new Renderer();
  renderer.textFormat = new Format('verdana48_bitmap', 14, 0xffffff);
  renderer.wordWrap = true;
  renderer.set_width(500);
  const field = new bitmap.Sprite();
  field.addChild(renderer);
  const pending: ((asset: ChatImageAsset) => void)[] = [];
  const cache = new ChatImageCache(() => ({
    loadCandidates(_urls, ok) {
      pending.push(ok);
    },
  }));
  let invalidations = 0;
  const images = new SimpleChatImages(resolve, cache, field, renderer, () => invalidations++);
  t.after(() => {
    images.dispose();
    field.dispose();
    cache.dispose();
    bitmap.cleanup();
  });
  const url = 'https://example.test/image.png';
  const row = { type: 'clan', text: 'Pilot: ' + url + ' suffix https://example.test/second.png' };
  const ordinary = { type: 'local', text: 'Local: ' + url };
  images.prefetch(ordinary);
  assert.equal(pending.length, 0);
  images.prefetch(row);
  assert.equal(pending.length, 1);
  const project = (rows: (typeof row)[]) => {
    const text = images.textForRows(rows);
    renderer.text = text;
    renderer.validate();
    images.position();
    return text;
  };
  let text = project([row, ordinary]);
  assert.equal(pending.length, 1);
  assert.ok(text.includes('\n suffix '));
  assert.ok(text.includes('[Image]'));
  assert.ok(text.endsWith(ordinary.text + '\n'));
  const thumbnail = field.getChildAt(1) as any;
  assert.equal(thumbnail.previewHeight, 16);
  const asset = new ChatImageAsset([{ dispose() {} }], [100], 440, 280);
  pending[0](asset);
  assert.equal(invalidations, 1);
  text = project([row, ordinary]);
  const expectedSize = ((140 * bitmap.font.size) / bitmap.font.lineHeight).toFixed(2);
  assert.ok(text.includes(`<font size='${expectedSize}'> </font>`));
  assert.equal(thumbnail.previewHeight, 140);
  assert.equal(asset.refCount, 1);
  assert.ok(thumbnail.x > 0);
  assert.equal(thumbnail.y, 0);
  assert.ok(renderer.get_height() > 140);
  const prefixed = { type: 'local', text: 'Earlier line' };
  project([prefixed, row]);
  assert.ok(thumbnail.y > 0);
  assert.equal(field.getChildAt(1), thumbnail);
  project([ordinary]);
  assert.equal(asset.refCount, 0);
  assert.equal(thumbnail.disposed, true);
  assert.equal(thumbnail.onPreviewSizeChanged, null);
  assert.equal(field.get_numChildren(), 1);
  assert.equal(project([]), '');
});
