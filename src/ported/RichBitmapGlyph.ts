// Source port of core/hud/components/chat/rich/RichBitmapGlyph.as.
import { bound, type Resolve } from '../runtime/As3';
export function createRichBitmapGlyph(resolve: Resolve): any {
  const JapaneseCachedGlyph: any = resolve('core.hud.components.chat.rich.JapaneseCachedGlyph');
  type JapaneseCachedGlyph = any;
  const BitmapChar: any = resolve('starling.text.BitmapChar');
  type BitmapChar = any;

  class RichBitmapGlyph {
    public static EMOJI_NATIVE_SIZE: number = 48;

    public character: BitmapChar = null;
    public japaneseGlyph: JapaneseCachedGlyph = null;
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

  return RichBitmapGlyph;
}
