import type { API, Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
// Original release naming and credit placement from Login.as.
export const CLIENT_VERSION = '1.1.23';
export const SOURCE_VERSION = '1.1.22';
export function loginIdentity(api: API, login: Raw) {
  const ui = new NativeUI(api);
  const label = ui.text(
    400,
    125,
    `QoLAF - v${CLIENT_VERSION} (Public)\nContains modifications from:\n  - ryd3v\n  - TheRealPancake\n  - Kaiser/Primiano\n  - TheLostOne\n  - mufenz\n`,
    12,
    0xffffff,
    'left',
    'DAIDRR_16',
  );
  label.set_name('qolaf.loginIdentity');
  label.set_autoSize('bothDirections');
  label.get_format().set_verticalAlign('top');
  ui.place(label, 10, 10, login);
  return () => ui.dispose(label);
}
