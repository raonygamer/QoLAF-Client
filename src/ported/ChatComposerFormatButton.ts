// Source port of core/hud/components/chat/ChatComposerFormatButton.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
import {
  Quad,
  Sprite,
  StarlingTextField as TextField,
  TextFormat,
  type TouchEvent,
} from '../game/Bindings';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';

export function createChatComposerFormatButton(resolve: Resolve) {
  resolve('starling.display.Sprite');
  resolve('starling.display.Quad');
  resolve('starling.text.TextField');
  resolve('starling.text.TextFormat');

  /** Small composer-toolbar button used to open a rich-text format panel. */
  /*[Event(name="triggered", type="starling.events.Event")]*/

  class ChatComposerFormatButton extends Sprite {
    private static IDLE_COLOR: number = 0x252525;
    private static HOVER_COLOR: number = 0x333333;
    private static DOWN_COLOR: number = 0x454545;
    private static DISABLED_COLOR: number = 0x171717;
    private static TEXT_COLOR: number = 0xe5e5e5;
    private static DISABLED_TEXT_COLOR: number = 0x666666;

    private background: Quad;
    private label: TextField;
    private _enabled: boolean = true;

    constructor(width: number, height: number, text: string) {
      super();
      this.background = new Quad(width, height, ChatComposerFormatButton.IDLE_COLOR);
      this.background.set_alpha(0.92);
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
      this.label.set_touchable(false);
      this.addChild(this.label);
      this.set_useHandCursor(true);
      this.addEventListener('touch', this.onTouch);
    }

    public get enabled(): boolean {
      return this._enabled;
    }

    public set enabled(value: boolean) {
      if (this._enabled == value) {
        return;
      }
      this._enabled = value;
      this.set_useHandCursor(value);
      this.background.set_color(
        value ? ChatComposerFormatButton.IDLE_COLOR : ChatComposerFormatButton.DISABLED_COLOR,
      );
      this.label
        .get_format()
        .set_color(
          value
            ? ChatComposerFormatButton.TEXT_COLOR
            : ChatComposerFormatButton.DISABLED_TEXT_COLOR,
        );
    }

    @bound
    private onTouch(event: TouchEvent): void {
      const touch = event.getTouch(this);
      if (touch == null) {
        this.background.set_color(
          this._enabled
            ? ChatComposerFormatButton.IDLE_COLOR
            : ChatComposerFormatButton.DISABLED_COLOR,
        );
        return;
      }
      // Do not let a toolbar click become an outside click for the editor.
      event.stopImmediatePropagation();
      if (!this._enabled) {
        return;
      }
      if (touch.get_phase() == 'hover') {
        this.background.set_color(ChatComposerFormatButton.HOVER_COLOR);
      } else if (
        touch.get_phase() == 'began' ||
        touch.get_phase() == 'moved' ||
        touch.get_phase() == 'stationary'
      ) {
        this.background.set_color(ChatComposerFormatButton.DOWN_COLOR);
      } else {
        this.background.set_color(ChatComposerFormatButton.IDLE_COLOR);
      }
      if (touch.get_phase() == 'ended' && !touch.get_cancelled()) {
        this.dispatchEventWith('triggered');
      }
    }

    @bound
    /*override*/
    public dispose(): void {
      this.removeEventListener('touch', this.onTouch);
      super.dispose();
    }
  }

  return ChatComposerFormatButton;
}
