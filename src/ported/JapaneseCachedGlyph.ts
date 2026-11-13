// Source port of core/hud/components/chat/rich/JapaneseCachedGlyph.as.
import type { Resolve } from '../runtime/HaxeInterop';
import type { BitmapChar } from '../game/Bindings';
import type { JapaneseGlyphPage } from './JapaneseGlyphPage';

export class JapaneseCachedGlyph {
  public codePoint: number = 0;
  public character: BitmapChar | null = null;
  public batchGroup: number = 0;
  public page: JapaneseGlyphPage | null = null;
  public slot: number = -1;
  public references: number = 0;
  public lastUsed: number = 0;
}

export function createJapaneseCachedGlyph(_resolve: Resolve): typeof JapaneseCachedGlyph {
  return JapaneseCachedGlyph;
}
