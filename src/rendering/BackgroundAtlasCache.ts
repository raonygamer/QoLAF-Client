import type { Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { TextureManager, type TextureAtlas } from '../game/Bindings';

/** Original two-atlas LRU, allowing temporary overflow only for pinned atlases. */
export class BackgroundAtlasCache {
  private readonly entries = new Map<string, TextureAtlas>();
  private readonly uses = new Map<string, number>();

  constructor(private readonly reflection: GameReflection) {}

  get(name: string): TextureAtlas | null {
    const entry = TextureManager.textureAtlasDict.h[name];
    return this.reflection.is(entry, 'starling.textures.TextureAtlas') ? entry : null;
  }

  cache(name: string): void {
    if (!this.touch(name)) return;
    this.trim();
  }

  acquire(name: string): Cleanup {
    if (!this.touch(name)) return () => {};
    this.uses.set(name, (this.uses.get(name) ?? 0) + 1);
    this.trim();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = (this.uses.get(name) ?? 1) - 1;
      if (count > 0) this.uses.set(name, count);
      else this.uses.delete(name);
      this.trim();
    };
  }

  /** Let native disposal handle every non-background texture using its current rules. */
  preserveDuring(dispose: () => void): void {
    this.trim();
    const dictionary = TextureManager.textureAtlasDict.h;
    const retained = new Map<string, TextureAtlas>();
    for (const [name, atlas] of this.entries) {
      if (dictionary[name] !== atlas) continue;
      retained.set(name, atlas);
      delete dictionary[name];
    }
    try {
      dispose();
    } finally {
      for (const [name, atlas] of retained) {
        // Native disposal is synchronous; do not overwrite a replacement entry.
        if (!Object.hasOwn(dictionary, name)) dictionary[name] = atlas;
      }
    }
  }

  private touch(name: string): boolean {
    const atlas = this.get(name);
    if (!atlas) return false;
    this.entries.delete(name);
    this.entries.set(name, atlas);
    return true;
  }

  private trim(): void {
    while (this.entries.size > 2) {
      const removable = [...this.entries.keys()].find((name) => !this.uses.has(name));
      if (removable === undefined) return;
      const atlas = this.entries.get(removable)!;
      this.entries.delete(removable);
      if (TextureManager.textureAtlasDict.h[removable] !== atlas) continue;
      atlas.dispose();
      delete TextureManager.textureAtlasDict.h[removable];
      delete TextureManager.xmlDict.h[removable.replace(/\.(png|jpe?g)$/i, '.xml')];
    }
  }
}
