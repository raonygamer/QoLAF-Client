import { japaneseFontAssets } from './JapaneseFontAssets';

/** Browser equivalent of the source's nine independent embedded-font loaders. */
export class JapaneseRuntimeFontLoader {
  private static started = false;
  private static ready = false;
  private static callbacks = new Set<() => void>();
  private static loadedFamilies = new Set<string>();

  static initialize(): void {
    if (this.started) return;
    this.started = true;
    void Promise.allSettled(
      japaneseFontAssets.map(async ({ family, source }) => {
        const face = new FontFace(family, `url("${source}")`);
        await face.load();
        document.fonts.add(face);
        this.loadedFamilies.add(family);
      }),
    ).then(() => {
      // As in the source, a failed subset does not prevent the others loading.
      // The cache uses the replacement glyph for any unavailable family.
      this.ready = true;
      const pending = [...this.callbacks];
      this.callbacks.clear();
      for (const callback of pending) callback();
    });
  }

  static get isReady(): boolean {
    return this.ready;
  }

  static hasFamily(family: string): boolean {
    return this.loadedFamilies.has(family);
  }

  static whenReady(callback: (() => void) | null): void {
    if (!callback) return;
    if (this.ready) callback();
    else {
      this.callbacks.add(callback);
      this.initialize();
    }
  }

  static removeReadyCallback(callback: () => void): void {
    this.callbacks.delete(callback);
  }
}
