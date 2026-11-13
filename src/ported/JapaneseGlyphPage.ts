import { BitmapData, Rectangle, Texture } from '../game/Bindings';
import type { Resolve } from '../runtime/HaxeInterop';

// Source port of core/hud/components/chat/rich/JapaneseGlyphPage.as.
export class JapaneseGlyphPage {
  public static SIZE: number = 1024;
  public static CELL_SIZE: number = 56;
  public static CELLS_PER_ROW: number = Math.trunc(
    JapaneseGlyphPage.SIZE / JapaneseGlyphPage.CELL_SIZE,
  );
  public static CAPACITY: number =
    JapaneseGlyphPage.CELLS_PER_ROW * JapaneseGlyphPage.CELLS_PER_ROW;

  public index: number = 0;
  public bitmap: BitmapData;
  public texture: Texture;
  public nextSlot: number = 0;
  public dirty: boolean = false;

  constructor(pageIndex: number) {
    this.index = pageIndex;
    this.bitmap = new BitmapData(JapaneseGlyphPage.SIZE, JapaneseGlyphPage.SIZE, true, 0x00000000);
    this.texture = Texture.fromBitmapData(this.bitmap, false, false, 1);
  }

  public get hasUnusedSlot(): boolean {
    return this.nextSlot < JapaneseGlyphPage.CAPACITY;
  }

  public takeUnusedSlot(): number {
    return this.hasUnusedSlot ? this.nextSlot++ : -1;
  }

  public cellBounds(slot: number, result: Rectangle | null = null): Rectangle {
    if (result == null) result = new Rectangle();
    result.setTo(
      (slot % JapaneseGlyphPage.CELLS_PER_ROW) * JapaneseGlyphPage.CELL_SIZE,
      Math.trunc(slot / JapaneseGlyphPage.CELLS_PER_ROW) * JapaneseGlyphPage.CELL_SIZE,
      JapaneseGlyphPage.CELL_SIZE,
      JapaneseGlyphPage.CELL_SIZE,
    );
    return result;
  }

  public clearSlot(slot: number): void {
    this.bitmap.fillRect(this.cellBounds(slot), 0x00000000);
    this.dirty = true;
  }

  public uploadIfDirty(): void {
    if (!this.dirty) return;
    this.texture.get_root()!.uploadBitmapData(this.bitmap);
    this.dirty = false;
  }
}

export function createJapaneseGlyphPage(_resolve: Resolve): typeof JapaneseGlyphPage {
  return JapaneseGlyphPage;
}
