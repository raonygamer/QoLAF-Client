import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeChatMessages } from '../src/chat/NativeChatMessages';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { ChatImageCache } from '../src/chat/ChatImageCache';
import { ChatImageAsset } from '../src/chat/ChatImageAsset';
import { Text } from './fixtures/NativeGame';
import { DeviceSettings } from '../src/settings/DeviceSettings';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('received chat uses source rich glyphs, wraps at viewport width and releases removed rows', (t) => {
  const fixture = bitmapRendererFixture('verdana16_bitmap');
  t.after(fixture.cleanup);
  const hooks = new Hooks(),
    cleanup: (() => void)[] = [];
  class Field extends fixture.Sprite {
    text = '';
    get_text() {
      return this.text;
    }
    set_text(text: string) {
      this.text = text;
    }
  }
  class WrapText extends fixture.Sprite {
    field = new Field();
    hasWidth = true;
    viewWidth = 200;
    maxWidth = 0;
    measuredWidth = 0;
    measuredHeight = 0;
    nativeLayouts = 0;
    constructor() {
      super();
      this.addChild(this.field);
      this.set_alpha(0.7);
    }
    get_text() {
      return this.field.get_text();
    }
    set_text(text: string) {
      this.field.set_text(text);
      this.layoutText();
    }
    get_width() {
      return this.viewWidth;
    }
    set_width(width: number) {
      this.viewWidth = width;
      this.layoutText();
      return width;
    }
    layoutText() {
      this.nativeLayouts++;
    }
  }
  const simple = { tf: new WrapText() };
  const scroll = Object.assign(new fixture.Sprite(), {
    arrange() {},
    scrollToPosition() {},
    get_verticalScrollPosition: () => 0,
    get_maxVerticalScrollPosition: () => 0,
  });
  const advanced = {
    scroll,
    addText(message: string | { text: string; type: string; playerName: string }) {
      const row = new WrapText();
      row.set_text(typeof message === 'string' ? message : message.text);
      scroll.addChild(row);
    },
  };
  const preferences = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
  const api: any = {
    cls: () => WrapText,
    around: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'around', fn)),
    after: (object: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(object, key, 'after', fn)),
    defer: (fn: () => void) => cleanup.push(fn),
  };
  const pending: ((asset: ChatImageAsset) => void)[] = [];
  const images = new ChatImageCache(() => ({
    loadCandidates(_urls, ok) {
      pending.push(ok);
    },
  }));
  t.after(() => images.dispose());
  installNativeChatMessages(
    api,
    { messageLog: { simple, advanced } },
    (name) => (name === 'starling.text.TextField' ? Text : fixture.resolve(name)),
    preferences,
    images,
  );
  t.after(() => cleanup.reverse().forEach((fn) => fn()));
  simple.tf.set_text("A<font color='#ff0000' size='24'>B</font>C");
  const renderer = simple.tf.getChildAt(0) as any;
  assert.equal(simple.tf.field.parent, null);
  assert.equal(simple.tf.get_alpha(), 1);
  assert.deepEqual(
    renderer.characterBatch.meshes.map((mesh: any) => mesh.color),
    [0xffffff, 0xff0000, 0xffffff],
  );
  assert.equal(renderer.characterBatch.meshes[1].scale, 24 / fixture.font.size);
  const originalHeight = renderer.get_height();
  simple.tf.set_text('a long received message with several words and a second line');
  simple.tf.set_width(70);
  assert.equal(renderer.get_width(), 70);
  assert.ok(renderer.get_height() > originalHeight);
  preferences.set('legacyChatFontSize', 22);
  assert.equal(renderer.textFormat.size, 22);
  advanced.addText('new row');
  const row = scroll.getChildAt(0) as any;
  const rowRenderer = row.getChildAt(0);
  assert.notEqual(rowRenderer, row.field);
  assert.equal(rowRenderer.text, 'new row');
  scroll.removeChild(row, true);
  assert.equal(row.field.disposed, true);
  assert.equal(rowRenderer.disposed, true);
  const url = 'https://example.test/preview.png';
  advanced.addText({ text: 'Pilot: ' + url, type: 'local', playerName: 'Pilot' });
  assert.equal(pending.length, 0); // Preserve newer upstream channel restrictions.
  advanced.addText({ text: 'Pilot: ' + url, type: 'clan', playerName: 'Pilot' });
  const imageRow = scroll.getChildAt(1) as any;
  const imageRenderer = imageRow.getChildAt(0);
  const thumbnail = imageRow.getChildAt(1);
  assert.equal(pending.length, 1);
  assert.equal(imageRenderer.collapseImageLinks, true);
  assert.equal(thumbnail.previewHeight, 16);
  const asset = new ChatImageAsset([{ dispose() {} }], [100], 440, 280);
  pending[0](asset);
  assert.equal(imageRow.measuredHeight, 140);
  assert.equal(thumbnail.previewWidth, 220);
  assert.equal(thumbnail.get_y(), 0);
  assert.equal(imageRenderer.get_y(), 140 - imageRenderer.get_height());
  assert.ok(thumbnail.get_x() > 0);
  assert.equal(asset.refCount, 1);
  scroll.removeChild(imageRow, true);
  assert.equal(asset.refCount, 0);
  assert.equal(thumbnail.onPreviewSizeChanged, null);
  cleanup.reverse().forEach((fn) => fn());
  cleanup.length = 0;
  assert.equal(simple.tf.getChildAt(0), simple.tf.field);
  assert.equal(simple.tf.get_alpha(), 0.7);
  assert.equal(renderer.disposed, true);
  assert.ok(simple.tf.nativeLayouts > 0);
});
