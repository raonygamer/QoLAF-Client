import { TextFormatAlign } from '../game/TextFormatAlign';
import type { API } from '../api/Types';
import { Quad, NativeTextFormat, type LoginInput } from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';

/** Original LoginInput presentation on the native browser-backed editor. */
export function installNativeLoginInput(api: API, field: LoginInput): () => void {
  const placeholder = field.placeholder;
  const error = field.errorText;
  const background = field.getChildAt(0);
  const border = field.border;
  const original = {
    backgroundVisible: background.get_visible(),
    borderVisible: border.get_visible(),
    placeholderY: placeholder.get_y(),
    placeholderFormat: placeholder.get_format().clone(),
    placeholderSnapping: placeholder.get_pixelSnapping(),
    errorFormat: error.get_format().clone(),
    errorSnapping: error.get_pixelSnapping(),
    inputFormat: field.input.textFormat,
    alpha: field.get_alpha(),
  };
  background.set_visible(false);
  border.set_visible(false);
  const line = new Quad(placeholder.get_width(), 1, 0xffffff);
  line.set_y(30);
  line.set_touchable(false);
  field.addChildAt(line, 0);
  const textFormat = original.placeholderFormat.clone();
  textFormat.set_font(RussoBitmapFontRegistry.fontNameForSize(12));
  textFormat.set_size(12);
  textFormat.set_color(0xffffff);
  textFormat.set_horizontalAlign('center');
  placeholder.set_format(textFormat);
  placeholder.set_y(4);
  placeholder.set_pixelSnapping(false);
  const errorFormat = original.errorFormat.clone();
  errorFormat.set_font(RussoBitmapFontRegistry.fontNameForSize(10));
  errorFormat.set_size(10);
  errorFormat.set_color(0xff0000);
  errorFormat.set_horizontalAlign('center');
  error.set_format(errorFormat);
  error.set_pixelSnapping(false);
  field.input.set_textFormat(
    new NativeTextFormat(
      'Verdana',
      14,
      0xffffff,
      null,
      null,
      null,
      null,
      null,
      TextFormatAlign.Center,
    ),
  );
  field.set_alpha(0.7);
  return () => {
    line.removeFromParent(true);
    background.set_visible(original.backgroundVisible);
    border.set_visible(original.borderVisible);
    placeholder.set_y(original.placeholderY);
    placeholder.set_format(original.placeholderFormat);
    placeholder.set_pixelSnapping(original.placeholderSnapping);
    error.set_format(original.errorFormat);
    error.set_pixelSnapping(original.errorSnapping);
    field.input.set_textFormat(original.inputFormat);
    field.set_alpha(original.alpha);
  };
}
