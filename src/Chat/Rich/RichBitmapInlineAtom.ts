// Source port of core/hud/components/chat/rich/RichBitmapInlineAtom.as.
import { bound } from '../../Runtime/As3';

/** One visible label that must serialize and edit as one raw source token. */

export class RichBitmapInlineAtom {
  public static INHERIT_COLOR: number = 0xffffffff;

  public visibleBegin: number = 0;
  public visibleEnd: number = 0;
  public sourceBegin: number = 0;
  public sourceEnd: number = 0;
  public sourceText: string | null = null;
  /** Optional display-only tint. It is intentionally not serialized. */
  public displayColor: number = 0;

  constructor(
    visibleBegin: number = 0,
    visibleEnd: number = 0,
    sourceBegin: number = 0,
    sourceEnd: number = 0,
    sourceText: string | null = null,
    displayColor: number = RichBitmapInlineAtom.INHERIT_COLOR,
  ) {
    this.visibleBegin = visibleBegin;
    this.visibleEnd = visibleEnd;
    this.sourceBegin = sourceBegin;
    this.sourceEnd = sourceEnd;
    this.sourceText = sourceText;
    this.displayColor = displayColor;
  }

  @bound
  public cloneShifted(visibleOffset: number = 0, sourceOffset: number = 0): RichBitmapInlineAtom {
    return new RichBitmapInlineAtom(
      this.visibleBegin + visibleOffset,
      this.visibleEnd + visibleOffset,
      this.sourceBegin + sourceOffset,
      this.sourceEnd + sourceOffset,
      this.sourceText,
      this.displayColor,
    );
  }
}
