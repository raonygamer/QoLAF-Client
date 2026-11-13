import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { LoginButton } from '../game/Bindings';
import type { Game } from '../game/Game';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';

/** Apply the original LoginButton appearance/interaction to an existing Haxe button. */
export function installNativeLoginButton(api: API, button: LoginButton): () => void {
  const reflection = new GameReflection(api);
  const label = button.displayText;
  const background = button.bg;
  const border = button.border;
  const format = label.get_format();
  const original = {
    backgroundHeight: background.get_height(),
    backgroundAlpha: background.get_alpha(),
    borderVisible: border.get_visible(),
    labelHeight: label.get_height(),
    labelY: label.get_y(),
    pixelSnapping: label.get_pixelSnapping(),
    font: format.get_font(),
    size: format.get_size(),
    alpha: button.get_alpha(),
    touchable: button.get_touchable(),
    cursor: button.get_useHandCursor(),
  };
  background.set_height(41);
  background.set_alpha(0.7);
  border.set_visible(false);
  label.set_height(30);
  label.set_y(6);
  label.set_pixelSnapping(false);
  format.set_font(RussoBitmapFontRegistry.fontNameForSize(12));
  format.set_size(12);
  const enabled = () => {
    const value = button.get_enabled();
    button.set_touchable(value);
    button.set_useHandCursor(value);
    button.set_alpha(value ? 1 : 0.4);
  };
  const touch = (event: Game.starling.events.TouchEvent) => {
    if (button.get_enabled() && button.callback && event.getTouch(button, 'ended'))
      button.callback();
  };
  // Native onTouch ignores _enabled and changes the background on every hover.
  // Replace its registered closure, retaining the live callback field.
  const restoreTouch = reflection.replaceListener(button, 'touch', button, button.onTouch, touch);
  const off = reflection.after(button, 'set_enabled', enabled);
  enabled();
  return () => {
    off();
    restoreTouch();
    background.set_height(original.backgroundHeight);
    background.set_alpha(original.backgroundAlpha);
    border.set_visible(original.borderVisible);
    label.set_height(original.labelHeight);
    label.set_y(original.labelY);
    label.set_pixelSnapping(original.pixelSnapping);
    format.set_font(original.font);
    format.set_size(original.size);
    button.set_alpha(original.alpha);
    button.set_touchable(original.touchable);
    button.set_useHandCursor(original.cursor);
  };
}
