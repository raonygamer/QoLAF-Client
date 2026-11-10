// Source port of core/hud/components/chat/ChatComposerFormatButton.as.
import { bound, type Resolve } from '../runtime/As3';
export function createChatComposerFormatButton(resolve: Resolve): any {
  const VerdanaBitmapFontRegistry: any = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = any;
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
  const TextField: any = resolve('starling.text.TextField');
  type TextField = any;
  const TextFormat: any = resolve('starling.text.TextFormat');
  type TextFormat = any;

  /** Small composer-toolbar button used to open a rich-text format panel. */
  /*[Event(name="triggered", type="starling.events.Event")]*/

  class ChatComposerFormatButton extends Sprite {
    private static IDLE_COLOR: number = 0x252525;
    private static HOVER_COLOR: number = 0x333333;
    private static DOWN_COLOR: number = 0x454545;
    private static DISABLED_COLOR: number = 0x171717;
    private static TEXT_COLOR: number = 0xe5e5e5;
    private static DISABLED_TEXT_COLOR: number = 0x666666;

    private background: Quad = null;
    private label: TextField = null;
    private _enabled: boolean = true;

    constructor(width: number, height: number, text: string) {
      super();
      this.background = new Quad(width, height, ChatComposerFormatButton.IDLE_COLOR);
      this.background.alpha = 0.92;
      this.addChild(this.background);
      this.label = new TextField(
        width,
        height,
        text,
        new TextFormat(
          VerdanaBitmapFontRegistry.fontNameForSize(10),
          10,
          ChatComposerFormatButton.TEXT_COLOR,
          'center',
        ),
      );
      this.label.touchable = false;
      this.addChild(this.label);
      this.useHandCursor = true;
      this.addEventListener(TouchEvent.TOUCH, this.onTouch);
    }

    public get enabled(): boolean {
      return this._enabled;
    }

    public set enabled(value: boolean) {
      if (this._enabled == value) {
        return;
      }
      this._enabled = value;
      this.useHandCursor = value;
      this.background.color = value
        ? ChatComposerFormatButton.IDLE_COLOR
        : ChatComposerFormatButton.DISABLED_COLOR;
      this.label.format.color = value
        ? ChatComposerFormatButton.TEXT_COLOR
        : ChatComposerFormatButton.DISABLED_TEXT_COLOR;
    }

    @bound
    private onTouch(event: TouchEvent): void {
      let touch: Touch = event.getTouch(this);
      if (touch == null) {
        this.background.color = this._enabled
          ? ChatComposerFormatButton.IDLE_COLOR
          : ChatComposerFormatButton.DISABLED_COLOR;
        return;
      }
      // Do not let a toolbar click become an outside click for the editor.
      event.stopImmediatePropagation();
      if (!this._enabled) {
        return;
      }
      if (touch.phase == TouchPhase.HOVER) {
        this.background.color = ChatComposerFormatButton.HOVER_COLOR;
      } else if (
        touch.phase == TouchPhase.BEGAN ||
        touch.phase == TouchPhase.MOVED ||
        touch.phase == TouchPhase.STATIONARY
      ) {
        this.background.color = ChatComposerFormatButton.DOWN_COLOR;
      } else {
        this.background.color = ChatComposerFormatButton.IDLE_COLOR;
      }
      if (touch.phase == TouchPhase.ENDED && !touch.cancelled) {
        this.dispatchEventWith(Event.TRIGGERED);
      }
    }

    @bound
    /*override*/
    public dispose(): void {
      this.removeEventListener(TouchEvent.TOUCH, this.onTouch);
      super.dispose();
    }
  }

  return ChatComposerFormatButton;
}
