import type { Resolve } from '../runtime/As3';

/** Original Button font selection and height semantics on native pointer handling. */
export function createButtonAdapter(NativeButton: any, resolve: Resolve): any {
  const Russo = resolve('core.text.RussoBitmapFontRegistry');
  const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
  const fontName = (family: string, size: number) => {
    if (family === 'DAIDRR') return Russo.fontNameForSize(size);
    if (family.toLowerCase() === 'verdana') return Verdana.fontNameForSize(size);
    return family;
  };
  return class Button extends NativeButton {
    static STYLE_NORMAL = 'normal';
    private logicalFontFamily: string;

    constructor(
      callback: Function,
      text = "I'm a button yeah",
      style = 'normal',
      size = 13,
      family = 'DAIDRR',
    ) {
      super(callback, text, style, size, fontName(family, size));
      this.logicalFontFamily = family;
      // Haxe substitutes "Button Text" for an empty constructor label. The
      // original leaves unbound key slots blank; restore the requested text
      // through the native setter before sizing the control.
      if (text === '') this.set_text('');
    }

    get_height(): number {
      return this.tf.get_height();
    }

    set_height(value: number): number {
      this.tf.set_height(value);
      this.styleImage.set_height(value);
      this.hoverImage.set_height(value);
      return value;
    }

    set_size(value: number): number {
      this.tf.get_format().set_size(value);
      this.tf.get_format().set_font(fontName(this.logicalFontFamily, value));
      this.update();
      return value;
    }
  };
}
