import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRichBitmapFontCompositor } from '../src/ported/RichBitmapFontCompositor';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';

test('Starling HTML uses bitmap glyph colors while plain text retains the native compositor', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  let plainCalls = 0;
  let fontDisposals = 0;
  class NativeFont {
    constructor() {
      Object.assign(this, fixture.font);
    }
    fillMeshBatch() {
      plainCalls++;
    }
    dispose() {
      fontDisposals++;
    }
  }
  const Compositor = createRichBitmapFontCompositor((name) =>
    name === 'starling.text.BitmapFont' ? NativeFont : fixture.Renderer,
  );
  const font = new Compositor();
  const output: { colors: number[]; y: number }[] = [];
  const target = {
    batchable: false,
    set_batchable(value: boolean) {
      this.batchable = value;
    },
    addMesh: (batch: any) =>
      output.push({ colors: batch.meshes.map((mesh: any) => mesh.color), y: batch.y }),
  };
  const format = {
    size: 16,
    color: 0xffffff,
    horizontalAlign: 'left',
    verticalAlign: 'bottom',
    leading: 0,
    kerning: true,
  };
  font.fillMeshBatch(target, 100, 60, 'plain', format, { isHtmlText: false });
  assert.equal(plainCalls, 1);
  assert.equal(target.batchable, true, 'plain labels use the same stable batch path');
  target.batchable = false;
  assert.equal(font.htmlRenderer, null);
  font.fillMeshBatch(target, 100, 60, '<font color="#123456">A</font>B', format, {
    isHtmlText: true,
    wordWrap: false,
    autoScale: false,
  });
  assert.equal(target.batchable, true);
  assert.deepEqual(output[0].colors, [0x123456, 0xffffff]);
  assert.equal(output[0].y, 60 - fixture.font.lineHeight);
  const renderer = font.htmlRenderer;
  font.fillMeshBatch(target, 1, 100000, '<font color="#00ff00">AB</font>', format, {
    isHtmlText: true,
    wordWrap: true,
    autoScale: false,
    autoSize: 'bothDirections',
  });
  assert.equal(renderer._numLines, 1, 'HTML autosize must not wrap to a stale one-pixel hit area');
  assert.ok(renderer.measuredWidth > 1);
  font.fillMeshBatch(target, 1, 100000, 'AB', format, {
    isHtmlText: true,
    wordWrap: true,
    autoScale: false,
    autoSize: 'vertical',
  });
  assert.equal(renderer._numLines, 2, 'vertical-only autosizing must retain explicit width');

  font.fillMeshBatch(target, 100, 60, '<font color="#ff0000">A</font>', format, {
    isHtmlText: true,
    wordWrap: false,
    autoScale: false,
  });
  assert.equal(font.htmlRenderer, renderer, 'reuse one scratch renderer per font');
  assert.deepEqual(output[3].colors, [0xff0000]);
  assert.deepEqual(
    output[0].colors,
    [0x123456, 0xffffff],
    'the destination owns copied glyph geometry',
  );
  font.dispose();
  assert.equal(renderer.disposed, true);
  assert.equal(fontDisposals, 1);
});
