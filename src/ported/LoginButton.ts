// Ported from core/hud/components/LoginButton.as; retain original layout and behavior.
import { bound, type Resolve } from '../runtime/As3';
export function createLoginButton(resolve: Resolve): any {
  const RussoBitmapFontRegistry: any = resolve('core.text.RussoBitmapFontRegistry');
  type RussoBitmapFontRegistry = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const TextField: any = resolve('starling.text.TextField');
  type TextField = any;
  const TextFormat: any = resolve('starling.text.TextFormat');
  type TextFormat = any;

  class LoginButton extends Sprite {
    private displayText!: TextField;
    private callback!: Function | null;
    private _enabled: boolean = true;

    constructor(
      param1: string,
      param2: Function | null,
      param3: number = 16777215,
      param4: number = 0,
      param5: number = 120,
    ) {
      super();
      this.callback = param2;
      var buttonWidth: number = Math.max(40, param5);
      var local7: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(12),
        12,
        param3,
      );
      var local5: Quad = new Quad(buttonWidth, 41, param4);
      local5.alpha = 0.7;
      this.addChild(local5);
      this.displayText = new TextField(buttonWidth, 30, param1, local7);
      this.displayText.pixelSnapping = false;
      this.displayText.y = 6;
      this.addChild(this.displayText);
      this.text = param1;
      this.useHandCursor = true;
      this.addEventListener('touch', this.onTouch);
    }

    @bound
    private onTouch(param1: TouchEvent): void {
      if (this._enabled && this.callback != null && param1.getTouch(this, 'ended')) {
        this.callback();
      }
    }

    public get text(): string {
      return this.displayText.text;
    }

    public set text(param1: string) {
      this.displayText.text = param1.toUpperCase();
    }

    public set enabled(param1: boolean) {
      this._enabled = param1;
      this.touchable = param1;
      this.useHandCursor = param1;
      this.alpha = param1 ? 1 : 0.4;
    }

    public get enabled(): boolean {
      return this._enabled;
    }

    @bound
    /*override*/
    public dispose(): void {
      this.removeEventListener('touch', this.onTouch);
      this.callback = null;
      super.dispose();
    }
  }

  return LoginButton;
}
