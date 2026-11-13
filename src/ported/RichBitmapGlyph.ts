// Source port of core/hud/components/chat/rich/RichBitmapGlyph.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
import type {} from '../game/BitmapChar';
import type { BitmapChar } from '../game/Bindings';
import type { JapaneseCachedGlyph } from './JapaneseCachedGlyph';

export class RichBitmapGlyph {
  public static EMOJI_NATIVE_SIZE: number = 48;

  public character: BitmapChar | null = null;
  public japaneseGlyph: JapaneseCachedGlyph | null = null;
  public batchGroup: number = 0;
  public charID: number = 0;
  public color: number = 0;
  public scale: number = NaN;
  public x: number = NaN;
  public advance: number = NaN;
  public visualRight: number = NaN;
  public isWhitespace: boolean = false;
  public isEmoji: boolean = false;
  public isClientDeveloperTag: boolean = false;
  public isEchoLabel: boolean = false;
  public textBegin: number = 0;
  public textEnd: number = 0;
  public hitX: number = NaN;
  public hitY: number = NaN;
  public hitWidth: number = NaN;
  public hitHeight: number = NaN;

  @bound
  public clear(): void {
    this.character = null;
    this.japaneseGlyph = null;
    this.batchGroup = 0;
    this.isEmoji = false;
    this.isClientDeveloperTag = false;
    this.isEchoLabel = false;
    this.textBegin = this.textEnd = 0;
    this.hitX = this.hitY = this.hitWidth = this.hitHeight = 0;
  }
}

export function createRichBitmapGlyph(_resolve: Resolve): typeof RichBitmapGlyph {
  return RichBitmapGlyph;
}
