// Source port of core/hud/components/chat/ChatSelectionValueSlider.as.
import { bound, type Resolve } from '../runtime/As3';
export function createChatSelectionValueSlider(resolve: Resolve): any {
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const Touch: any = resolve('starling.events.Touch');
  type Touch = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const TouchPhase: any = resolve('starling.events.TouchPhase');
  type TouchPhase = any;

  /** Lightweight charcoal slider used only by ChatSelectionFormatPopup. */

  class ChatSelectionValueSlider extends Sprite {
    private static TRACK_COLOR: number = 0x343434;
    private static FILL_COLOR: number = 0x808080;
    private static KNOB_COLOR: number = 0xd0d0d0;
    private static KNOB_ACTIVE_COLOR: number = 0xffffff;
    private static KNOB_WIDTH: number = 12;

    private interactionArea: Quad = null;
    private track: Quad = null;
    private fill: Quad = null;
    private knob: Quad = null;
    private controlWidth: number = NaN;
    private _minimum: number = NaN;
    private _maximum: number = NaN;
    private _step: number = NaN;
    private _value: number = NaN;
    private point: Point = new Point();
    private activeTouchID: number = -1;

    constructor(minimum: number, maximum: number, step: number, width: number, height: number) {
      super();
      this._minimum = minimum;
      this._maximum = maximum;
      this._step = step;
      this._value = minimum;
      this.controlWidth = width;
      this.useHandCursor = true;

      // Sprite hit testing only considers the actual pixels occupied by its
      // children. Previously that made most of this nominally 24 px-high
      // control inert: only the four-pixel track and the current knob could
      // begin a drag. Keep one nearly transparent quad behind the chrome so
      // the complete advertised rectangle is a reliable interaction area.
      this.interactionArea = new Quad(width, height, ChatSelectionValueSlider.TRACK_COLOR);
      this.interactionArea.alpha = 0.001;
      this.addChild(this.interactionArea);
      this.track = new Quad(width, 4, ChatSelectionValueSlider.TRACK_COLOR);
      this.track.y = Math.round((height - this.track.height) / 2);
      this.track.touchable = false;
      this.addChild(this.track);
      this.fill = new Quad(1, 4, ChatSelectionValueSlider.FILL_COLOR);
      this.fill.y = this.track.y;
      this.fill.touchable = false;
      this.addChild(this.fill);
      this.knob = new Quad(
        ChatSelectionValueSlider.KNOB_WIDTH,
        height,
        ChatSelectionValueSlider.KNOB_COLOR,
      );
      this.knob.touchable = false;
      this.addChild(this.knob);
      this.addEventListener(TouchEvent.TOUCH, this.onTouch);
      this.updateVisuals();
    }

    public get value(): number {
      return this._value;
    }

    public set value(next: number) {
      next = this.clampAndSnap(next);
      if (this._value == next) {
        return;
      }
      this._value = next;
      this.updateVisuals();
    }

    @bound
    private onTouch(event: TouchEvent): void {
      let touch: Touch =
        this.activeTouchID < 0
          ? event.getTouch(this)
          : event.getTouch(this, null, this.activeTouchID);
      if (touch == null) {
        this.activeTouchID = -1;
        this.knob.color = ChatSelectionValueSlider.KNOB_COLOR;
        return;
      }
      if (touch.phase == TouchPhase.BEGAN) {
        this.activeTouchID = touch.id;
      }
      if (
        touch.phase == TouchPhase.BEGAN ||
        touch.phase == TouchPhase.MOVED ||
        touch.phase == TouchPhase.STATIONARY
      ) {
        this.knob.color = ChatSelectionValueSlider.KNOB_ACTIVE_COLOR;
      } else {
        this.knob.color = ChatSelectionValueSlider.KNOB_COLOR;
      }
      if (touch.phase == TouchPhase.ENDED) {
        this.activeTouchID = -1;
      }
      if (touch.phase != TouchPhase.BEGAN && touch.phase != TouchPhase.MOVED) {
        return;
      }
      touch.getLocation(this, this.point);
      let range: number = Math.max(1, this.controlWidth - ChatSelectionValueSlider.KNOB_WIDTH);
      let next: number =
        this._minimum +
        Math.max(0, Math.min(1, (this.point.x - ChatSelectionValueSlider.KNOB_WIDTH / 2) / range)) *
          (this._maximum - this._minimum);
      next = this.clampAndSnap(next);
      if (this._value == next) {
        return;
      }
      this._value = next;
      this.updateVisuals();
      this.dispatchEventWith(Event.CHANGE);
    }

    @bound
    private clampAndSnap(next: number): number {
      if (isNaN(next)) {
        next = this._minimum;
      }
      next = Math.max(this._minimum, Math.min(this._maximum, next));
      if (this._step > 0) {
        next = this._minimum + Math.round((next - this._minimum) / this._step) * this._step;
        next = Math.max(this._minimum, Math.min(this._maximum, next));
      }
      return next;
    }

    @bound
    private updateVisuals(): void {
      let ratio: number =
        this._maximum == this._minimum
          ? 0
          : (this._value - this._minimum) / (this._maximum - this._minimum);
      this.knob.x = Math.round(ratio * (this.controlWidth - ChatSelectionValueSlider.KNOB_WIDTH));
      this.knob.y = 0;
      this.fill.width = Math.max(1, this.knob.x + ChatSelectionValueSlider.KNOB_WIDTH / 2);
      this.fill.height = 4;
    }

    @bound
    /*override*/
    public dispose(): void {
      this.removeEventListener(TouchEvent.TOUCH, this.onTouch);
      this.activeTouchID = -1;
      this.point = null;
      super.dispose();
    }
  }

  return ChatSelectionValueSlider;
}
