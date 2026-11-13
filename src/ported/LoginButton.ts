// Ported from core/hud/components/LoginButton.as.
import { Sprite, Quad, StarlingTextField, TextFormat } from '../game/Bindings';
import type { Game } from '../game/Game';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import { bound, type Resolve } from '../runtime/HaxeInterop';

export function createLoginButton(resolve: Resolve) {
  // Other source screens still use property access on this native superclass.
  resolve('starling.display.Sprite');

  class LoginButton extends Sprite {
    private readonly displayText: StarlingTextField;
    private callback: (() => void) | null;
    private _enabled = true;

    constructor(
      text: string,
      callback: (() => void) | null,
      textColor = 0xffffff,
      backgroundColor = 0,
      width = 120,
    ) {
      super();
      this.callback = callback;
      const buttonWidth = Math.max(40, width);
      const format = new TextFormat(RussoBitmapFontRegistry.fontNameForSize(12), 12, textColor);
      const background = new Quad(buttonWidth, 41, backgroundColor);
      background.set_alpha(0.7);
      this.addChild(background);
      this.displayText = new StarlingTextField(buttonWidth, 30, text, format);
      this.displayText.set_pixelSnapping(false);
      this.displayText.set_y(6);
      this.addChild(this.displayText);
      this.text = text;
      this.set_useHandCursor(true);
      this.addEventListener('touch', this.onTouch);
    }

    @bound
    private onTouch(event: Game.starling.events.TouchEvent): void {
      if (this._enabled && this.callback && event.getTouch(this, 'ended')) this.callback();
    }

    get text(): string {
      return this.displayText.get_text();
    }

    set text(value: string) {
      this.displayText.set_text(value.toUpperCase());
    }

    set enabled(value: boolean) {
      this._enabled = value;
      this.set_touchable(value);
      this.set_useHandCursor(value);
      this.set_alpha(value ? 1 : 0.4);
    }

    get enabled(): boolean {
      return this._enabled;
    }

    @bound
    override dispose(): void {
      this.removeEventListener('touch', this.onTouch);
      this.callback = null;
      super.dispose();
    }
  }

  return LoginButton;
}
