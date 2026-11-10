// Source port of core/hud/components/chat/ChatEmojiPickerModel.as.
import { EmojiPickerCatalog } from './EmojiPickerCatalog';
/**
 * Allocation-free paging state for ChatEmojiPicker.
 *
 * Keeping this separate from Starling display state makes category coverage,
 * row clamping, and scrollbar behavior deterministic and easy to test.
 */

export class ChatEmojiPickerModel {
  public static COLUMNS: number = 12;
  public static VISIBLE_ROWS: number = 5;
  public static VISIBLE_CELLS: number =
    ChatEmojiPickerModel.COLUMNS * ChatEmojiPickerModel.VISIBLE_ROWS;

  private _categoryIndex: number = 0;
  private _scrollRow: number = 0;

  public get categoryCount(): number {
    return EmojiPickerCatalog.CATEGORY_COUNT;
  }

  public get categoryIndex(): number {
    return this._categoryIndex;
  }

  public get categoryLength(): number {
    return EmojiPickerCatalog.categoryLengthAt(this._categoryIndex);
  }

  public get totalRows(): number {
    return Math.ceil(this.categoryLength / ChatEmojiPickerModel.COLUMNS);
  }

  public get maxScrollRow(): number {
    return Math.max(0, this.totalRows - ChatEmojiPickerModel.VISIBLE_ROWS);
  }

  public get scrollRow(): number {
    return this._scrollRow;
  }

  public get scrollRatio(): number {
    return this.maxScrollRow == 0 ? 0 : this._scrollRow / this.maxScrollRow;
  }

  public get visibleFraction(): number {
    return this.totalRows <= ChatEmojiPickerModel.VISIBLE_ROWS
      ? 1
      : ChatEmojiPickerModel.VISIBLE_ROWS / this.totalRows;
  }

  public categoryNameAt(index: number): string {
    return EmojiPickerCatalog.categoryNameAt(index);
  }

  public categoryIconAt(index: number): number {
    return EmojiPickerCatalog.categoryIconAt(index);
  }

  public selectCategory(index: number): boolean {
    if (index < 0 || index >= this.categoryCount || index == this._categoryIndex) {
      return false;
    }
    this._categoryIndex = index;
    this._scrollRow = 0;
    return true;
  }

  public scrollByRows(delta: number): boolean {
    if (delta == 0) {
      return false;
    }
    return this.setScrollRow(this._scrollRow + delta);
  }

  public pageBy(delta: number): boolean {
    return this.scrollByRows(delta * ChatEmojiPickerModel.VISIBLE_ROWS);
  }

  public setScrollRatio(value: number): boolean {
    if (isNaN(value)) {
      value = 0;
    }
    value = Math.max(0, Math.min(1, value));
    return this.setScrollRow(Math.round(value * this.maxScrollRow));
  }

  public visibleScalarAt(cellIndex: number): number {
    if (cellIndex < 0 || cellIndex >= ChatEmojiPickerModel.VISIBLE_CELLS) {
      return 0;
    }
    const scalarIndex: number = this._scrollRow * ChatEmojiPickerModel.COLUMNS + cellIndex;
    return EmojiPickerCatalog.scalarAt(this._categoryIndex, scalarIndex);
  }

  private setScrollRow(value: number): boolean {
    value = Math.max(0, Math.min(this.maxScrollRow, value));
    if (value == this._scrollRow) {
      return false;
    }
    this._scrollRow = value;
    return true;
  }
}
