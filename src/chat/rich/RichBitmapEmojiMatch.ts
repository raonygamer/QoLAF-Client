// Source port of core/hud/components/chat/rich/RichBitmapEmojiMatch.as.
import { bound } from '../../runtime/HaxeInterop';

/** Reusable result from RichBitmapEmojiResolver. */

export class RichBitmapEmojiMatch {
  public codePoint: number = 0;
  public glyphID: number = -1;
  public consumed: number = 1;
  public isEmoji: boolean = false;
  public isIgnored: boolean = false;

  @bound
  /*internal*/
  reset(): void {
    this.codePoint = 0;
    this.glyphID = -1;
    this.consumed = 1;
    this.isEmoji = false;
    this.isIgnored = false;
  }
}
