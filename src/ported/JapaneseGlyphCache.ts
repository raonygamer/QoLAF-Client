import { BitmapChar, Rectangle, Texture, StarlingTextField as TextField } from '../game/Bindings';
import type { BitmapFont } from '../game/Bindings';
import { JapaneseGlyphPage } from './JapaneseGlyphPage';
import { JapaneseCachedGlyph } from './JapaneseCachedGlyph';
import type { JapaneseRuntimeFontLoader as FontLoader } from '../chat/rich/JapaneseRuntimeFontLoader';
type GlyphEntries = Partial<Record<string, JapaneseCachedGlyph>>;
type ProtectedKeys = Readonly<Record<string, boolean>> | null;
interface GlyphSlot {
  page: JapaneseGlyphPage;
  slot: number;
}
// Source port of core/hud/components/chat/rich/JapaneseGlyphCache.as.
import type { Resolve } from '../runtime/HaxeInterop';
import { createJapaneseRasterizer } from '../ui/JapaneseRasterizer';
export function createJapaneseGlyphCache(resolve: Resolve) {
  const JapaneseRuntimeFontLoader = resolve(
    'core.hud.components.chat.rich.JapaneseRuntimeFontLoader',
  ) as typeof FontLoader;
  const rasterizer = createJapaneseRasterizer(resolve);

  /** Shared static-kana and bounded-page runtime-kanji cache. */

  class JapaneseGlyphCache {
    private static FONT_SIZE: number = 42;
    private static BASELINE: number = 48;
    private static CELL_PADDING: number = 3;
    private static BASE_PAGE_COUNT: number = 3;

    private static kanaFont: BitmapFont | null = null;
    private static kanaEntries: GlyphEntries = {};
    private static kanjiEntries: GlyphEntries = {};
    private static pages: JapaneseGlyphPage[] = [];
    private static useCounter: number = 0;

    private static scratchRect: Rectangle = new Rectangle();

    public static prepare(value: string): void {
      JapaneseRuntimeFontLoader.initialize();
      if (value == null || value.length == 0) return;
      const required: Record<string, boolean> = {};
      let i: number;
      let codePoint: number;
      for (i = 0; i < value.length; i++) {
        codePoint = value.charCodeAt(i);
        if (JapaneseGlyphCache.isRuntimeKanji(codePoint)) required[String(codePoint)] = true;
      }
      let key: string;
      for (key in required) {
        codePoint = Number(key);
        const existing = JapaneseGlyphCache.kanjiEntries[key];
        if (existing != null) {
          existing.lastUsed = ++JapaneseGlyphCache.useCounter;
        } else {
          JapaneseGlyphCache.rasterize(codePoint, required, false);
        }
      }
      for (const page of JapaneseGlyphCache.pages) {
        page.uploadIfDirty();
      }
    }

    public static acquire(codePoint: number): JapaneseCachedGlyph | null {
      if (JapaneseGlyphCache.isStaticJapanese(codePoint)) {
        return JapaneseGlyphCache.acquireKana(codePoint);
      }
      if (!JapaneseGlyphCache.isRuntimeKanji(codePoint)) return null;
      let key: string = String(codePoint);
      let entry: JapaneseCachedGlyph | null | undefined = JapaneseGlyphCache.kanjiEntries[key];
      if (entry == null) {
        entry = JapaneseGlyphCache.rasterize(codePoint, null, true);
      }
      if (entry != null) {
        entry.references++;
        entry.lastUsed = ++JapaneseGlyphCache.useCounter;
      }
      return entry ?? null;
    }

    public static release(entry: JapaneseCachedGlyph | null): void {
      if (entry != null && entry.page != null && entry.references > 0) {
        entry.references--;
      }
    }

    public static get allocatedKanjiPages(): number {
      return JapaneseGlyphCache.pages.length;
    }

    public static initialize(): void {
      JapaneseRuntimeFontLoader.initialize();
    }

    public static whenReady(callback: () => void): void {
      JapaneseRuntimeFontLoader.whenReady(callback);
    }

    public static removeReadyCallback(callback: () => void): void {
      JapaneseRuntimeFontLoader.removeReadyCallback(callback);
    }

    private static acquireKana(codePoint: number): JapaneseCachedGlyph | null {
      JapaneseGlyphCache.initializeKana();
      let key: string = String(codePoint);
      let entry = JapaneseGlyphCache.kanaEntries[key];
      if (entry != null) return entry;
      let character: BitmapChar | null = JapaneseGlyphCache.kanaFont?.getChar(codePoint) ?? null;
      if (character == null) return null;
      entry = new JapaneseCachedGlyph();
      entry.codePoint = codePoint;
      entry.character = character;
      entry.batchGroup = 1;
      JapaneseGlyphCache.kanaEntries[key] = entry;
      return entry;
    }

    private static initializeKana(): void {
      if (JapaneseGlyphCache.kanaFont == null)
        JapaneseGlyphCache.kanaFont = TextField.getBitmapFont('noto_japanese_kana48');
    }

    private static rasterize(
      codePoint: number,
      protectedKeys: ProtectedKeys,
      uploadNow: boolean,
    ): JapaneseCachedGlyph | null {
      if (!JapaneseRuntimeFontLoader.isReady) return null;
      const family = JapaneseGlyphCache.runtimeFontName(codePoint);
      if (!family || !JapaneseRuntimeFontLoader.hasFamily(family)) return null;
      const raster = rasterizer.rasterize(
        String.fromCharCode(codePoint),
        family,
        JapaneseGlyphCache.FONT_SIZE,
      );
      if (!raster) return null;
      const allocation = JapaneseGlyphCache.allocateSlot(protectedKeys);
      if (!allocation) return null;
      const page = allocation.page;
      const slot = allocation.slot;
      page.clearSlot(slot);
      const cell = page.cellBounds(slot, JapaneseGlyphCache.scratchRect);
      rasterizer.copyTo(
        page.bitmap,
        cell.x + JapaneseGlyphCache.CELL_PADDING,
        cell.y + JapaneseGlyphCache.CELL_PADDING,
      );
      const region = new Rectangle(
        cell.x + JapaneseGlyphCache.CELL_PADDING,
        cell.y + JapaneseGlyphCache.CELL_PADDING,
        raster.width,
        raster.height,
      );
      const texture = Texture.fromTexture(page.texture, region);
      const character = new BitmapChar(
        codePoint,
        texture,
        raster.left,
        JapaneseGlyphCache.BASELINE + raster.top,
        raster.advance,
      );
      const entry = new JapaneseCachedGlyph();
      entry.codePoint = codePoint;
      entry.character = character;
      entry.batchGroup = page.index + 2;
      entry.page = page;
      entry.slot = slot;
      entry.lastUsed = ++JapaneseGlyphCache.useCounter;
      JapaneseGlyphCache.kanjiEntries[String(codePoint)] = entry;
      page.dirty = true;
      if (uploadNow) page.uploadIfDirty();
      return entry;
    }

    private static allocateSlot(protectedKeys: ProtectedKeys): GlyphSlot {
      for (const available of JapaneseGlyphCache.pages) {
        if (available.hasUnusedSlot) {
          return { page: available, slot: available.takeUnusedSlot() };
        }
      }
      if (JapaneseGlyphCache.pages.length < JapaneseGlyphCache.BASE_PAGE_COUNT) {
        let created: JapaneseGlyphPage = new JapaneseGlyphPage(JapaneseGlyphCache.pages.length);
        JapaneseGlyphCache.pages.push(created);
        return { page: created, slot: created.takeUnusedSlot() };
      }

      let oldest: JapaneseCachedGlyph | null = null;
      let key: string;
      for (key in JapaneseGlyphCache.kanjiEntries) {
        const candidate = JapaneseGlyphCache.kanjiEntries[key];
        if (
          candidate == null ||
          candidate.references != 0 ||
          candidate.page == null ||
          candidate.character == null ||
          (protectedKeys != null && protectedKeys[key])
        )
          continue;
        if (oldest == null || candidate.lastUsed < oldest.lastUsed) {
          oldest = candidate;
        }
      }
      if (oldest?.page != null && oldest.character != null) {
        delete JapaneseGlyphCache.kanjiEntries[String(oldest.codePoint)];
        oldest.character.texture.dispose();
        oldest.page.clearSlot(oldest.slot);
        return { page: oldest.page, slot: oldest.slot };
      }

      // All three normal pages are still referenced by visible renderers.
      // Preserve those glyphs and grow only under that exceptional pressure.
      const created = new JapaneseGlyphPage(JapaneseGlyphCache.pages.length);
      JapaneseGlyphCache.pages.push(created);
      return { page: created, slot: created.takeUnusedSlot() };
    }

    private static isStaticJapanese(codePoint: number): boolean {
      return (
        (codePoint >= 0x3000 && codePoint <= 0x303f) ||
        (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
        (codePoint >= 0x31f0 && codePoint <= 0x31ff) ||
        (codePoint >= 0xff01 && codePoint <= 0xff9f)
      );
    }

    private static isRuntimeKanji(codePoint: number): boolean {
      return (
        (codePoint >= 0x2e80 && codePoint <= 0x2fdf) ||
        (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
        (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
        (codePoint >= 0xf900 && codePoint <= 0xfaff)
      );
    }

    private static runtimeFontName(codePoint: number): string | null {
      if (codePoint >= 0x2e80 && codePoint <= 0x2fdf) {
        return 'QoLAF Japanese Radicals';
      }
      if (codePoint >= 0x3400 && codePoint <= 0x3fff) {
        return 'QoLAF Japanese ExtA1';
      }
      if (codePoint >= 0x4000 && codePoint <= 0x4dbf) {
        return 'QoLAF Japanese ExtA2';
      }
      if (codePoint >= 0x4e00 && codePoint <= 0x5fff) {
        return 'QoLAF Japanese U1';
      }
      if (codePoint >= 0x6000 && codePoint <= 0x6fff) {
        return 'QoLAF Japanese U2';
      }
      if (codePoint >= 0x7000 && codePoint <= 0x7fff) {
        return 'QoLAF Japanese U3';
      }
      if (codePoint >= 0x8000 && codePoint <= 0x8fff) {
        return 'QoLAF Japanese U4';
      }
      if (codePoint >= 0x9000 && codePoint <= 0x9fff) {
        return 'QoLAF Japanese U5';
      }
      if (codePoint >= 0xf900 && codePoint <= 0xfaff) {
        return 'QoLAF Japanese Compat';
      }
      return null;
    }
  }

  return JapaneseGlyphCache;
}
