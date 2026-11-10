import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJapaneseGlyphCache } from '../src/ported/JapaneseGlyphCache';
import { createJapaneseGlyphPage } from '../src/ported/JapaneseGlyphPage';
import { createJapaneseCachedGlyph } from '../src/ported/JapaneseCachedGlyph';

test('Japanese cache preserves active glyphs, evicts only released entries, and batches page uploads', (t) => {
  const oldDocument = globalThis.document;
  const context = {
    clearRect() {},
    fillText() {},
    measureText: () => ({
      width: 42,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 40,
      actualBoundingBoxAscent: 38,
      actualBoundingBoxDescent: 2,
    }),
  };
  globalThis.document = { createElement: () => ({ getContext: () => context }) } as any;
  t.after(() => {
    globalThis.document = oldDocument;
  });
  let uploads = 0;
  let disposals = 0;
  class Point {
    x = 0;
    y = 0;
    setTo(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }
  class Rectangle extends Point {
    width = 0;
    height = 0;
    setTo(x: number, y: number, width = 0, height = 0) {
      super.setTo(x, y);
      this.width = width;
      this.height = height;
    }
  }
  class BitmapData {
    static fromCanvas() {
      return { dispose() {} };
    }
    fillRect() {}
    copyPixels() {}
  }
  class BitmapChar {
    constructor(
      public codePoint: number,
      public texture: any,
      public xOffset: number,
      public yOffset: number,
      public xAdvance: number,
    ) {}
  }
  const kana = { getChar: (code: number) => (code === 0x3042 ? { codePoint: code } : null) };
  const registry: Record<string, any> = {
    'openfl.geom.Point': Point,
    'openfl.geom.Rectangle': Rectangle,
    'openfl.display.BitmapData': BitmapData,
    'starling.text.BitmapChar': BitmapChar,
    'starling.text.BitmapFont': class {},
    'starling.text.TextField': { getBitmapFont: () => kana },
    'starling.textures.Texture': {
      fromBitmapData: () => ({
        root: {
          uploadBitmapData() {
            uploads++;
          },
        },
      }),
      fromTexture: () => ({
        dispose() {
          disposals++;
        },
      }),
    },
    'core.hud.components.chat.rich.JapaneseRuntimeFontLoader': {
      initialize() {},
      isReady: true,
      hasFamily: () => true,
    },
  };
  const resolve = (name: string) => {
    assert.ok(registry[name], name);
    return registry[name];
  };
  const Glyph = createJapaneseCachedGlyph(resolve);
  const Page = createJapaneseGlyphPage(resolve);
  registry['core.hud.components.chat.rich.JapaneseCachedGlyph'] = Glyph;
  registry['core.hud.components.chat.rich.JapaneseGlyphPage'] = Page;
  const Cache = createJapaneseGlyphCache(resolve);
  assert.equal(Page.CAPACITY, 324);
  const staticGlyph = Cache.acquire(0x3042);
  assert.equal(staticGlyph.batchGroup, 1);
  assert.equal(Cache.acquire(0x3042), staticGlyph);
  assert.equal(Cache.acquire(65), null);
  const active: any[] = [];
  for (let index = 0; index < Page.CAPACITY * 3; index++)
    active.push(Cache.acquire(0x4e00 + index));
  assert.equal(Cache.allocatedKanjiPages, 3);
  assert.equal(disposals, 0);
  Cache.release(active[0]);
  const replacement = Cache.acquire(0x6000);
  assert.equal(replacement.page, active[0].page);
  assert.equal(replacement.slot, active[0].slot);
  assert.equal(Cache.allocatedKanjiPages, 3);
  assert.equal(disposals, 1);
  Cache.acquire(0x6001);
  assert.equal(
    Cache.allocatedKanjiPages,
    4,
    'grow only when all normal-page glyphs remain referenced',
  );
  for (const entry of active.slice(1)) assert.equal(entry.references, 1);
  const before = uploads;
  Cache.prepare('漢字漢');
  assert.equal(uploads - before, 1, 'prepare uploads a dirty page once for the entire string');
  const character = Cache.acquire('字'.charCodeAt(0));
  assert.equal(character.character.yOffset, 10, 'source baseline 48 minus glyph ascent 38');
  assert.equal(character.character.xAdvance, 42);
  Cache.release(character);
  Cache.release(character);
  assert.equal(character.references, 0, 'release never underflows');
});
