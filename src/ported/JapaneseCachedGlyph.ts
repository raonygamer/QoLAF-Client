// Source port of core/hud/components/chat/rich/JapaneseCachedGlyph.as.
import type { Resolve } from '../runtime/As3';
export function createJapaneseCachedGlyph(resolve: Resolve): any {
  type JapaneseGlyphPage = any;
  type BitmapChar = any;

  class JapaneseCachedGlyph {
    public codePoint: number = 0;
    public character: BitmapChar = null;
    public batchGroup: number = 0;
    public page: JapaneseGlyphPage = null;
    public slot: number = -1;
    public references: number = 0;
    public lastUsed: number = 0;
  }

  return JapaneseCachedGlyph;
}
