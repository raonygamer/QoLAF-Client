import type { API, Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { bindNativeBitmapInput, type NativeBitmapInput } from '../chat/rich/NativeBitmapInput';

/** Feathers chat-input contract, backed by the game's native input and bitmap editor. */
export function createBitmapInputAdapter(api: API, resolve: Resolve): any {
  const Sprite = resolve('starling.display.Sprite');
  const TextEntry = resolve('core.hud.components.ui.TextEntry');
  const TextFormat = resolve('openfl.text.TextFormat');
  const Quad = resolve('starling.display.Quad');
  return class BitmapInputAdapter extends Sprite {
    private readonly entry: Raw;
    private readonly editor: NativeBitmapInput;
    private readonly background: Raw;
    private removed = false;
    readonly textEditorProperties: Raw;
    readonly richEditor: Raw;
    styleName = '';
    private idleColor = 0x191919;
    private focusColor = 0x292929;
    private promptText = '';

    constructor() {
      super();
      this.entry = new TextEntry('plain');
      this.entry.set_maxChars(150);
      this.entry.set_textFormat(new TextFormat('Verdana', 14, 0xffffff));
      this.entry.paddingLeft = this.entry.paddingRight = 8;
      this.entry.paddingTop = this.entry.paddingBottom = 3;
      this.entry.applyPadding();
      this.background = new Quad(1, 1, 0x191919);
      this.background.set_alpha(0.86);
      this.entry.setBackground(this.background);
      this.addChild(this.entry);
      this.editor = bindNativeBitmapInput(api, this.entry, resolve);
      this.textEditorProperties = {};
      Object.defineProperty(this.textEditorProperties, 'textFormat', {
        set: (format: Raw) =>
          this.entry.set_textFormat(new TextFormat('Verdana', format.size, format.color)),
      });
      const element: HTMLInputElement = this.entry.element;
      // The popup uses Flash's native focus dispatcher solely for keyboard events.
      const keyName = (name: string) => (name === 'keyDown' ? 'keydown' : name);
      this.richEditor = {
        nativeFocus: {
          addEventListener: (name: string, fn: EventListener) =>
            element.addEventListener(keyName(name), fn, true),
          removeEventListener: (name: string, fn: EventListener) =>
            element.removeEventListener(keyName(name), fn, true),
        },
      };
      this.entry.addEventListener('change', this.onChange);
      this.entry.addEventListener('focusIn', this.onFocusIn);
      this.entry.addEventListener('focusOut', this.onFocusOut);
    }

    private readonly onChange = () => this.dispatchEventWith('change');
    private readonly onFocusIn = () => {
      this.background.set_color(this.focusColor);
      this.dispatchEventWith('focusIn');
    };
    private readonly onFocusOut = () => {
      this.background.set_color(this.idleColor);
      this.dispatchEventWith('focusOut');
    };

    setBackgroundAppearance(color: number, focusedColor = color, alpha = 1): void {
      this.idleColor = color;
      this.focusColor = focusedColor;
      this.background.set_color(this.hasFocus ? focusedColor : color);
      this.background.set_alpha(alpha);
    }

    get isEnabled(): boolean {
      return this.entry.get_isEnabled();
    }
    set isEnabled(value: boolean) {
      this.entry.set_isEnabled(value);
      this.touchable = value;
      if (!value) this.clearFocus();
    }

    get text(): string {
      return this.entry.get_text();
    }
    set text(value: string) {
      this.entry.set_text(value);
    }
    get prompt(): string {
      return this.promptText;
    }
    set prompt(value: string) {
      this.promptText = value ?? '';
      this.editor.view.setPrompt(this.promptText);
    }
    get maxChars(): number {
      return this.entry.maxChars;
    }
    set maxChars(value: number) {
      this.entry.set_maxChars(value);
    }
    get restrict(): string | null {
      return this.entry.restrict;
    }
    set restrict(value: string | null) {
      this.entry.set_restrict(value);
    }
    get hasFocus(): boolean {
      return this.entry.element.ownerDocument.activeElement === this.entry.element;
    }
    get_width(): number {
      return this.entry.get_width();
    }
    set_width(value: number): number {
      this.entry.set_width(value);
      this.editor.layout();
      return value;
    }
    get_height(): number {
      return this.entry.get_height();
    }
    set_height(value: number): number {
      this.entry.set_height(value);
      this.editor.layout();
      return value;
    }
    set paddingLeft(value: number) {
      this.setPadding('paddingLeft', value);
    }
    set paddingRight(value: number) {
      this.setPadding('paddingRight', value);
    }
    set paddingTop(value: number) {
      this.setPadding('paddingTop', value);
    }
    set paddingBottom(value: number) {
      this.setPadding('paddingBottom', value);
    }
    private setPadding(key: string, value: number): void {
      this.entry[key] = value;
      this.entry.applyPadding();
      this.editor.layout();
    }
    setFocus(): void {
      this.entry.setFocus();
    }
    clearFocus(): void {
      this.entry.element.blur();
    }
    selectRange(begin: number, end: number): void {
      this.entry.selectRange(begin, end);
    }
    validate(): void {
      this.editor.layout();
    }
    dispose(): void {
      if (this.removed) return;
      this.removed = true;
      this.clearFocus();
      this.entry.removeEventListener('change', this.onChange);
      this.entry.removeEventListener('focusIn', this.onFocusIn);
      this.entry.removeEventListener('focusOut', this.onFocusOut);
      this.editor.dispose();
      super.dispose();
    }
  };
}
