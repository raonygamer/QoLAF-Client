import { bound, type Resolve } from '../runtime/As3';

/** Original RadioQueryInput presentation; native editor retains the complete query and selection. */
export function createRadioInput(resolve: Resolve) {
  const Entry = resolve('core.hud.components.ui.TextEntry');
  const Text = resolve('core.hud.components.Text');
  const Quad = resolve('starling.display.Quad');
  const Format = resolve('openfl.text.TextFormat');
  class RadioInput extends Entry {
    private preview: any;
    private surface: any;
    private closed = false;

    constructor(x: number, y: number, width: number, height: number) {
      super('plain');
      this.set_x(x);
      this.set_y(y);
      this.set_width(width);
      this.set_height(height);
      this.paddingLeft = this.paddingRight = 8;
      this.applyPadding();
      this.set_textFormat(new Format('Verdana', 12, 0xe0e4e7));
      this.surface = new Quad(width, height, 0x161a1d);
      this.setBackground(this.surface);
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

    get prompt(): string {
      return this.element.placeholder;
    }
    set prompt(value: string) {
      this.element.placeholder = value;
      this.refreshPreview();
    }

    @bound
    private refreshPreview(): void {
      if (this.closed || !this.preview) return;
      const editing =
        this.element.ownerDocument.activeElement === this.element && this.get_isEnabled();
      this.preview.visible = !editing;
      this.element.style.opacity = editing ? '1' : '0';
      if (editing) return;
      const text = this.get_text();
      const value = text ? (this.displayAsPassword ? '•'.repeat(text.length) : text) : this.prompt;
      this.preview.color = text ? 0xe0e4e7 : 0x8b9198;
      this.preview.alpha = this.get_isEnabled() ? 1 : 0.48;
      this.preview.text = value;
      const available = Math.max(0, this.get_width() - 16);
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
      this.preview.x = 8;
      this.preview.y = Math.round((this.get_height() - this.preview.height) / 2);
    }

    dispose(): void {
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
