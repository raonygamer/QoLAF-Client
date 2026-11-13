// Source port of core/hud/components/chat/rich/RichBitmapLine.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
import type { RichBitmapGlyph } from './RichBitmapGlyph';

export class RichBitmapLine {
  public glyphs: RichBitmapGlyph[] = [];
  public cursor: number = NaN;
  public width: number = NaN;
  public lineHeight: number = NaN;
  public baseline: number = NaN;
  public previousCharID: number = -1;
  public previousWasEmoji: boolean = false;

  constructor() {
    this.clear();
  }

  @bound
  public clear(): void {
    this.glyphs.length = 0;
    this.cursor = 0;
    this.width = 0;
    this.lineHeight = 0;
    this.baseline = 0;
    this.previousCharID = -1;
    this.previousWasEmoji = false;
  }
}

export function createRichBitmapLine(_resolve: Resolve): typeof RichBitmapLine {
  return RichBitmapLine;
}
