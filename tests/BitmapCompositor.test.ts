import { bindGameClasses, type MeshBatch, type TextFormat } from '../src/game/Bindings';
import type { Game } from '../src/game/Game';
import type { API } from '../src/api/Types';
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
      Object.defineProperties(this, Object.getOwnPropertyDescriptors(fixture.font));
    }
    fillMeshBatch() {
      plainCalls++;
    }
    dispose() {
      fontDisposals++;
    }
  }
  bindGameClasses({
    cls: (name: string) => {
      if (name === 'starling.text.BitmapFont') return NativeFont;
      try {
        return fixture.resolve(name);
      } catch {
        return {};
      }
    },
  } as unknown as API);
  const Compositor = createRichBitmapFontCompositor((name) =>
    name === 'starling.text.BitmapFont' ? NativeFont : fixture.Renderer,
  );
  const font = new Compositor();
  const output: { colors: number[]; y: number }[] = [];
  const targetFixture = {
    batchable: false,
    set_batchable(value: boolean) {
      this.batchable = value;
    },
    addMesh: (batch: any) =>
      output.push({ colors: batch.meshes.map((mesh: any) => mesh.color), y: batch.y }),
  };
  const target = targetFixture as unknown as MeshBatch & { batchable: boolean };
  const formatFixture = {
    size: 16,
    color: 0xffffff,
    horizontalAlign: 'left',
    verticalAlign: 'bottom',
    leading: 0,
    kerning: true,
    get_size() {
      return this.size;
    },
    get_color() {
      return this.color;
    },
    get_horizontalAlign() {
      return this.horizontalAlign;
    },
    get_verticalAlign() {
      return this.verticalAlign;
    },
    get_leading() {
      return this.leading;
    },
    get_kerning() {
      return this.kerning;
    },
  };
  const format = formatFixture as unknown as TextFormat;
  font.fillMeshBatch(
    target,
    100,
    60,
    'plain',
    format,
    nativeOptions({ get_isHtmlText: () => false }),
  );
  assert.equal(plainCalls, 1);
  assert.equal(target.batchable, true, 'plain labels use the same stable batch path');
  target.batchable = false;
  assert.equal(font.htmlRenderer === null, true);
  font.fillMeshBatch(
    target,
    100,
    60,
    '<font color="#123456">A</font>B',
    format,
    nativeOptions({
      get_isHtmlText: () => true,
      get_wordWrap: () => false,
      get_autoScale: () => false,
      get_autoSize: () => 'none',
    }),
  );
  assert.equal(target.batchable, true);
  assert.deepEqual(output[0].colors, [0x123456, 0xffffff]);
  assert.equal(output[0].y, 60 - fixture.font.lineHeight);
  const renderer = font.htmlRenderer;
  assert.ok(renderer);
  font.fillMeshBatch(
    target,
    1,
    100000,
    '<font color="#00ff00">AB</font>',
    format,
    nativeOptions({
      get_isHtmlText: () => true,
      get_wordWrap: () => true,
      get_autoScale: () => false,
      get_autoSize: () => 'bothDirections',
    }),
  );
  assert.equal(renderer.numLines, 1, 'HTML autosize must not wrap to a stale one-pixel hit area');
  assert.ok(renderer['measuredWidth'] > 1);
  font.fillMeshBatch(
    target,
    1,
    100000,
    'AB',
    format,
    nativeOptions({
      get_isHtmlText: () => true,
      get_wordWrap: () => true,
      get_autoScale: () => false,
      get_autoSize: () => 'vertical',
    }),
  );
  assert.equal(renderer.numLines, 2, 'vertical-only autosizing must retain explicit width');

  font.fillMeshBatch(
    target,
    100,
    60,
    '<font color="#ff0000">A</font>',
    format,
    nativeOptions({
      get_isHtmlText: () => true,
      get_wordWrap: () => false,
      get_autoScale: () => false,
      get_autoSize: () => 'none',
    }),
  );
  assert.equal(font.htmlRenderer, renderer, 'reuse one scratch renderer per font');
  assert.deepEqual(output[3].colors, [0xff0000]);
  assert.deepEqual(
    output[0].colors,
    [0x123456, 0xffffff],
    'the destination owns copied glyph geometry',
  );
  font.dispose();
  assert.equal((renderer as unknown as { disposed: boolean }).disposed, true);
  assert.equal(fontDisposals, 1);
});

function nativeOptions(
  value: Partial<
    Pick<
      Game.starling.text.TextOptions,
      'get_isHtmlText' | 'get_wordWrap' | 'get_autoScale' | 'get_autoSize'
    >
  >,
): Game.starling.text.TextOptions {
  return value as Game.starling.text.TextOptions;
}
