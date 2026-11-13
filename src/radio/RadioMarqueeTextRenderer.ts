import { bound, type Resolve } from '../runtime/HaxeInterop';
/** Source: core/hud/components/dialogs/RadioMarqueeTextRenderer.as. */
export function createRadioMarqueeTextRenderer(resolve: Resolve) {
  const RichBitmapFontTextRenderer = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  );
  const Quad = resolve('starling.display.Quad');
  const Event = {
    ADDED_TO_STAGE: 'addedToStage',
    REMOVED_FROM_STAGE: 'removedFromStage',
    ENTER_FRAME: 'enterFrame',
  };
  /** Radio-only overflow presentation: move the existing glyph batch, never re-layout per frame. */
  class RadioMarqueeTextRenderer extends RichBitmapFontTextRenderer {
    private static readonly SPEED: number = 28;
    private static readonly PAUSE: number = 1.25;
    private viewportMask: any = null;
    private overflow: number = 0;
    private elapsed: number = 0;
    private previousText: string = '';
    private previousWidth: number = -1;
    private previousContentWidth: number = -1;
    private listening: boolean = false;
    private closed: boolean = false;
    constructor() {
      super();
      this.wordWrap = false;
      this.truncateToFit = false;
      this.pixelSnapping = false;
      this.touchable = false;
      this.addEventListener(Event.ADDED_TO_STAGE, this.added);
      this.addEventListener(Event.REMOVED_FROM_STAGE, this.removed);
    }
    @bound
    protected draw(): void {
      if (this.closed) return;
      // The AS3-bound base getter must not install its draw method over this override.
      RichBitmapFontTextRenderer.prototype.draw.call(this);
      let viewportWidth: number = Math.max(0, Math.min(this.width, this.maxWidth));
      let contentWidth: number = this.unscrolledTextWidth;
      if (
        this.text != this.previousText ||
        viewportWidth != this.previousWidth ||
        contentWidth != this.previousContentWidth
      ) {
        this.elapsed = 0;
        this.previousText = this.text;
        this.previousWidth = viewportWidth;
        this.previousContentWidth = contentWidth;
      }
      this.overflow =
        !this.wordWrap && viewportWidth > 0 && isFinite(viewportWidth) && isFinite(contentWidth)
          ? Math.max(0, contentWidth - viewportWidth)
          : 0;
      if (contentWidth > viewportWidth && viewportWidth >= 0) {
        if (this.viewportMask == null) this.viewportMask = new Quad(1, 1);
        this.viewportMask.touchable = false;
        this.viewportMask.width = Math.max(0.01, viewportWidth);
        this.viewportMask.height = Math.max(0.01, this.height);
        this.mask = this.viewportMask;
      } else this.mask = null;
      this.setTextScrollOffset(RadioMarqueeTextRenderer.offsetAt(this.elapsed, this.overflow));
      this.syncFrameListener();
    }
    @bound
    public static offsetAt(seconds: number, distance: number): number {
      if (!(distance > 0) || !isFinite(distance) || !isFinite(seconds)) return 0;
      let travel: number = distance / RadioMarqueeTextRenderer.SPEED;
      let phase: number = Math.max(0, seconds) % (2 * (RadioMarqueeTextRenderer.PAUSE + travel));
      if (phase <= RadioMarqueeTextRenderer.PAUSE) return 0;
      if (phase <= RadioMarqueeTextRenderer.PAUSE + travel)
        return -(phase - RadioMarqueeTextRenderer.PAUSE) * RadioMarqueeTextRenderer.SPEED;
      if (phase <= 2 * RadioMarqueeTextRenderer.PAUSE + travel) return -distance;
      return (
        -distance +
        (phase - 2 * RadioMarqueeTextRenderer.PAUSE - travel) * RadioMarqueeTextRenderer.SPEED
      );
    }
    @bound
    private syncFrameListener(): void {
      let needed: boolean = !this.closed && this.stage != null && this.overflow > 0;
      if (needed == this.listening) return;
      this.listening = needed;
      if (needed) this.addEventListener(Event.ENTER_FRAME, this.advance);
      else this.removeEventListener(Event.ENTER_FRAME, this.advance);
    }
    @bound
    private added(event: any): void {
      this.elapsed = 0;
      this.setTextScrollOffset(0);
      this.syncFrameListener();
    }
    @bound
    private removed(event: any): void {
      this.removeEventListener(Event.ENTER_FRAME, this.advance);
      this.listening = false;
      this.elapsed = 0;
      this.setTextScrollOffset(0);
    }
    @bound
    private advance(event: any): void {
      const passedTime = event.get_passedTime?.() ?? event.passedTime;
      if (this.closed || this.isInvalid() || !(passedTime > 0) || !isFinite(passedTime)) return;
      let current: any = this;
      while (current != null) {
        if (!current.visible || current.alpha <= 0) {
          this.elapsed = 0;
          this.setTextScrollOffset(0);
          return;
        }
        current = current.parent;
      }
      // Do not jump to another part of the title after a stall/background pause.
      this.elapsed += Math.min(0.1, passedTime);
      this.setTextScrollOffset(RadioMarqueeTextRenderer.offsetAt(this.elapsed, this.overflow));
    }
    @bound
    public dispose(): void {
      if (this.closed) return;
      this.closed = true;
      this.removeEventListener(Event.ADDED_TO_STAGE, this.added);
      this.removeEventListener(Event.REMOVED_FROM_STAGE, this.removed);
      this.removed(null);
      this.mask = null;
      if (this.viewportMask != null) this.viewportMask.dispose();
      this.viewportMask = null;
      super.dispose();
    }
  }

  return RadioMarqueeTextRenderer;
}
