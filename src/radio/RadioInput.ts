import type { TextEntry } from '../game/Bindings';
import { placeNativeInput } from '../ui/NativeInputPlacement';
import { bound, type Resolve } from '../runtime/HaxeInterop';

/** Native InputText boundary; only RadioQueryInput covers its unfocused editor with a preview. */
export function createRadioInput(resolve: Resolve, queryPreview = false) {
  const Entry = resolve('core.hud.components.ui.TextEntry') as typeof TextEntry;
  const Text = resolve('core.hud.components.Text');
  const Quad = resolve('starling.display.Quad');
  const Format = resolve('openfl.text.TextFormat');
  const Overlay = resolve('core.hud.components.ui.DomOverlay');
  class RadioInput extends Entry {
    private preview: any;
    private surface: any;
    private previewBackground: any;
    private closed = false;

    constructor(x: number, y: number, width: number, height: number) {
      super('plain');
      this.set_x(x);
      this.set_y(y);
      this.set_width(width);
      this.set_height(height);
      this.paddingLeft = this.paddingRight = queryPreview ? 8 : 5;
      this.paddingTop = 2;
      this.applyPadding();
      this.set_textFormat(new Format('Verdana', 12, 0xe0e0e0));
      // The original text_input.jpg is uniformly RGB(52,59,65). Keeping it as
      // a quad reproduces the asset without an asynchronous texture dependency.
      this.surface = new Quad(width, height, 0x343b41);
      this.surface.touchable = false;
      this.setBackground(this.surface);
      this.previewBackground = new Quad(1, 1, 0x161a1d);
      this.previewBackground.touchable = false;
      this.addChild(this.previewBackground);
      this.preview = new Text();
      this.preview.font = 'Verdana';
      this.preview.size = 12;
      this.preview.touchable = false;
      this.addChild(this.preview);
      this.addEventListener('enterFrame', this.refreshPreview);
      this.addEventListener('focusIn', this.refreshPreview);
      this.addEventListener('focusOut', this.refreshPreview);
      this.refreshPreview();
    }

    updatePlacement(): boolean {
      const shown = super.updatePlacement();
      if (shown) placeNativeInput(this, Overlay);
      return shown;
    }

    get prompt(): string {
      return this.element!.placeholder;
    }
    set prompt(value: string) {
      this.element!.placeholder = value;
      this.refreshPreview();
    }

    @bound
    private refreshPreview(): void {
      if (this.closed || !this.preview) return;
      const editing =
        this.element!.ownerDocument.activeElement === this.element && this.get_isEnabled();
      const text = this.get_text();
      const covered = !editing && (queryPreview || !text);
      this.preview.visible = covered;
      this.previewBackground.visible = queryPreview && !editing;
      this.element!.style.opacity = covered ? '0' : '1';
      if (editing) return;
      if (!covered) return;
      this.previewBackground.x = this.previewBackground.y = 1;
      this.previewBackground.width = Math.max(1, this.get_width() - 2);
      this.previewBackground.height = Math.max(1, this.get_height() - 2);
      const value = text ? (this.displayAsPassword ? '•'.repeat(text.length) : text) : this.prompt;
      this.preview.color = text ? 0xe0e4e7 : 0x8b9198;
      this.preview.alpha = this.get_isEnabled() ? 1 : 0.48;
      this.preview.text = value;
      const available = Math.max(0, this.get_width() - this.paddingLeft - this.paddingRight);
      if (this.preview.width > available) {
        let low = 0;
        let high = value.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          this.preview.text = value.slice(0, middle) + '…';
          if (this.preview.width <= available) low = middle;
          else high = middle - 1;
        }
        if (low > 0 && /[\uD800-\uDBFF]/.test(value[low - 1])) low--;
        this.preview.text = value.slice(0, low) + '…';
        if (this.preview.width > available) this.preview.text = '';
      }
      this.preview.x = this.paddingLeft;
      this.preview.y = Math.round((this.get_height() - this.preview.height) / 2);
    }

    dispose(): void {
      if (this.closed) return;
      this.closed = true;
      this.removeEventListener('enterFrame', this.refreshPreview);
      this.removeEventListener('focusIn', this.refreshPreview);
      this.removeEventListener('focusOut', this.refreshPreview);
      this.surface.removeFromParent(true);
      super.dispose();
    }
  }
  return RadioInput;
}
