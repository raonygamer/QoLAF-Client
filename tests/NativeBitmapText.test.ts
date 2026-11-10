import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { bridgeNativeBitmapText } from '../src/ui/NativeTextBridge';
import { Format } from './fixtures/NativeGame';

test('native Text retains identity, renders HTML colors, and restores its upstream path on unload', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const cleanups: (() => void)[] = [];
  class NativeText extends fixture.Sprite {
    format: any = new Format();
    _hAlign = 0;
    _vAlign = 0;
    oldText = 'AB';
    finalLayer: any = null;
    keepWhenRemoved = false;
    restoredDraws = 0;
    tf = {
      text: 'AB',
      html: 'AB',
      width: 100,
      height: 100,
      wordWrap: false,
      get_text() {
        return this.text;
      },
      get_htmlText() {
        return this.html;
      },
      get_width() {
        return this.width;
      },
      get_height() {
        return this.height;
      },
      get_wordWrap() {
        return this.wordWrap;
      },
      set_text(value: string) {
        this.text = value;
      },
      set_htmlText(value: string) {
        this.html = value;
      },
      set_width(value: number) {
        this.width = value;
      },
      set_height(value: number) {
        this.height = value;
      },
      set_wordWrap(value: boolean) {
        this.wordWrap = value;
      },
      set_defaultTextFormat() {},
    };
    constructor() {
      super();
      this.format.font = 'DAIDRR';
      this.format.size = 16;
      this.format.color = 0xffffff;
    }
    get_text() {
      return this.tf.get_text();
    }
    set_text(value: string) {
      this.tf.set_text(value);
      return value;
    }
    set_htmlText(value: string) {
      this.tf.set_htmlText(value);
      return value;
    }
    draw() {
      this.restoredDraws++;
    }
  }
  const oldSetter = NativeText.prototype.set_text;
  const instance = new NativeText();
  bridgeNativeBitmapText(
    { cls: () => NativeText, defer: (fn: () => void) => cleanups.push(fn) } as any,
    fixture.Text,
  );
  assert.equal(instance.get_text(), 'AB');
  assert.ok(instance instanceof NativeText);
  instance.set_htmlText('<font color="#00ff00">A</font>B');
  assert.deepEqual(
    instance.finalLayer.characterBatch.meshes.map((m: any) => m.color),
    [0x00ff00, 0xffffff],
  );
  assert.equal(instance.get_text(), 'AB');
  const renderer = instance.finalLayer;
  for (const cleanup of cleanups.reverse()) cleanup();
  assert.equal(NativeText.prototype.set_text, oldSetter);
  assert.equal(instance.tf.html, '<font color="#00ff00">A</font>B');
  assert.equal(instance.restoredDraws, 1);
  assert.equal(renderer.disposed, true);
  instance.set_text('after unload');
  assert.equal(instance.get_text(), 'after unload');
});
