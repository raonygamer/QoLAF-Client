import { ShipVisualCooldown } from './ShipVisualCooldown';
import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { createBitmapClasses } from '../ui/BitmapClasses';
import { createBitmapInputAdapter } from '../ui/BitmapInputAdapter';
import { bridgeNativeProperties } from '../runtime/As3';
import { installPopupKeyboard } from '../dialogs/NativePopupKeyboard';
import { createWeaponColorPopup } from './WeaponColorPopup';
import { WeaponColors } from './WeaponColors';
import { installNativeWeaponColors } from './NativeWeaponColors';

export function installNativeWeaponColorPopup(api: API, game: Raw): void {
  const chat = game.chatInput;
  if (!chat || !game.me) return;
  const resolve = portedClasses(api).resolve;
  const colors = new WeaponColors();
  const storageKey = 'weapon-colors:' + game.me.id;
  try {
    colors.restore(api.storage.get(storageKey, {}));
  } catch {
    /* Session values still work. */
  }
  installNativeWeaponColors(api, game, resolve, colors);
  let Popup: any;
  let popup: any = null;
  let weaponKey = '';
  const cooldown = ShipVisualCooldown.forGame(game);
  const write = (message: string) => api.cls('core.hud.components.chat.MessageLog')?.write(message);
  const available = () =>
    api.game === game && !game.isLeaving && !game.isRecoveringGameConnection && game.me?.ship;
  const save = () => {
    try {
      api.storage.set(storageKey, colors.snapshot());
    } catch {
      write('Weapon colors applied for this session; local storage is unavailable.');
    }
  };
  const ready = () => {
    const remaining = cooldown.remaining(performance.now());
    if (remaining === 0) return true;
    write('Wait ' + (remaining / 1000).toFixed(1) + 's before using /sv again.');
    return false;
  };
  const close = () => {
    const previous = popup;
    popup = null;
    weaponKey = '';
    if (!previous) return;
    previous.removeEventListener('accept', accept);
    previous.removeEventListener('close', close);
    if (read(previous, 'parent')) {
      const recovering = game.isRecoveringGameConnection;
      game.removeChildFromOverlay(previous, true);
      if (recovering) game.blockHotkeys = true;
    } else previous.dispose();
  };
  const accept = () => {
    if (!popup) return;
    if (!available()) {
      close();
      return;
    }
    if (!popup.validColor || !ready()) return;
    if (!game.me.ship.weapons?.some((weapon: Raw) => weapon.key === weaponKey)) {
      write('[error] The selected weapon is no longer available.');
      close();
      return;
    }
    const color = popup.color;
    if (!colors.set(weaponKey, { color, grayscale: popup.grayscale })) return;
    cooldown.mark(performance.now());
    save();
    const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    write(
      "'" +
        popup.weaponName +
        "' color changed to RGB(" +
        rgb.join(', ') +
        ') (#' +
        color.toString(16).toUpperCase().padStart(6, '0') +
        ')' +
        (popup.grayscale ? ' with grayscale texture.' : '.'),
    );
    close();
  };
  const open = () => {
    if (popup || !available()) return;
    const weapon = read(game.me.ship, 'weapon');
    if (!WeaponColors.validKey(weapon?.key)) {
      write('[error] Select a weapon before choosing its color.');
      return;
    }
    if (!Popup) {
      const bitmap = createBitmapClasses(resolve);
      const Input = createBitmapInputAdapter(api, bitmap.resolve);
      bridgeNativeProperties(Input);
      Popup = createWeaponColorPopup(resolve, Input);
    }
    weaponKey = weapon.key;
    const style = colors.get(weaponKey);
    popup = new Popup(
      style?.color ?? -1,
      style?.grayscale ?? false,
      read(weapon, 'name', weapon.key),
    );
    popup.addEventListener('accept', accept);
    popup.addEventListener('close', close);
    game.addChildToOverlay(popup, true);
  };
  const previousOpen = Object.getOwnPropertyDescriptor(chat, 'openWeaponColorPopup');
  chat.openWeaponColorPopup = open;
  api.around(chat, 'sendMessage', (next, ...args) => {
    const text = read(chat.input, 'text', '').trim();
    const match =
      /^\/(?:sv|shipvisual|ship)\s+(?:(wc|weapon-color)(?:\s+(r|reset))?|(reset|r)\s+weapon)$/i.exec(
        text,
      );
    if (!match) return next(...args);
    if (available()) {
      if (!match[2] && !match[3]) open();
      else if (ready()) {
        const weapon = read(game.me.ship, 'weapon');
        if (match[3]) {
          colors.reset();
          write('Custom weapon colors reset. Ship visuals are unchanged.');
        } else if (WeaponColors.validKey(weapon?.key)) {
          colors.reset(weapon.key);
          write(
            "Custom color reset for '" +
              read(weapon, 'name', weapon.key) +
              "'; normal weapon coloring owns it again.",
          );
        } else {
          write('[error] Select a weapon before resetting its custom color.');
          return;
        }
        cooldown.mark(performance.now());
        save();
      }
    }
    chat.input.set_text('');
    chat.updateTab();
  });
  api.defer(installPopupKeyboard(window, () => popup !== null, close));
  api.defer(() => {
    close();
    if (previousOpen) Object.defineProperty(chat, 'openWeaponColorPopup', previousOpen);
    else delete chat.openWeaponColorPopup;
  });
}
