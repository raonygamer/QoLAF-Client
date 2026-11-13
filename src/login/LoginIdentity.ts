import { StarlingTextField, type Login } from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
// Original release naming and credit placement from Login.as.
export const CLIENT_VERSION = '1.2.0';
export const CLIENT_VERSION_LABEL = `${CLIENT_VERSION} TS`;
export const CLIENT_REVISION = 123;
export const CLIENT_BUILD =
  typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__ ? 'Private' : 'Public';
export const SOURCE_VERSION = '1.1.22';
export function loginIdentity(login: Login): () => void {
  const label = new StarlingTextField(
    400,
    125,
    `QoLAF - v${CLIENT_VERSION_LABEL} (${CLIENT_BUILD})\nContains modifications from:\n  - ryd3v\n  - TheRealPancake\n  - Kaiser/Primiano\n  - TheLostOne\n  - mufenz\n`,
  );
  const format = label.get_format();
  format.set_font(RussoBitmapFontRegistry.fontNameForSize(12));
  format.set_size(12);
  format.set_color(0xffffff);
  format.set_horizontalAlign('left');
  format.set_verticalAlign('top');
  label.set_touchable(false);
  label.set_wordWrap(false);
  label.set_autoScale(false);
  label.set_name('qolaf.loginIdentity');
  label.set_pixelSnapping(false);
  label.set_autoSize('bothDirections');
  label.set_x(10);
  label.set_y(10);
  login.addChild(label);
  return () => {
    label.removeFromParent();
    label.dispose();
  };
}
