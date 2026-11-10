import { ShipVisualCooldown } from './ShipVisualCooldown';
import { read, type API, type Raw } from '../api/Types';
import { portedClasses } from '../ported/Registry';
import { createBitmapClasses } from '../ui/BitmapClasses';
import { createBitmapInputAdapter } from '../ui/BitmapInputAdapter';
import { bridgeNativeProperties } from '../runtime/As3';
import { installPopupKeyboard } from '../dialogs/NativePopupKeyboard';
import { ClientDevVisual } from './ClientDevVisual';
import { createClientDevVisualStyles } from './ClientDevVisualStyle';
import { createClientDevVisualPopup } from './ClientDevVisualPopup';

import { installNativePhaseBlade, type HullPalette } from './NativePhaseBlade';
import { isClientDeveloper } from './ClientVisualAuthority';

/** Draft-only native editor. Hull application never modifies course, hitboxes or weapons. */
export function installNativeClientDevVisual(api: API, game: Raw): void {
  const chat = game.chatInput;
  if (!chat) return;
  const resolve = portedClasses(api).resolve;
  let styles: ReturnType<typeof createClientDevVisualStyles> | undefined;
  let Popup: any;
  let popup: any = null;
  let mode = 'default';
  let settings = ClientDevVisual.defaults();
  let palette: HullPalette | null = null;
  const cooldown = ShipVisualCooldown.forGame(game);
  let clip: any = null;
  let ownedStyle: any = null;
  let previousStyle: any = null;
  let previousFilter: any = null;
  const storageKey = 'hull-visual:' + game.me.id;
  const write = (message: string) => api.cls('core.hud.components.chat.MessageLog')?.write(message);
  try {
    const saved = api.storage.get<Raw | null>(storageKey, null);
    if (isClientDeveloper(game.me.id)) {
      const restoredMode = ClientDevVisual.fromState(saved);
      const restoredSettings = ClientDevVisual.settingsFromState(saved);
      if (restoredMode && restoredSettings) {
        mode = restoredMode;
        settings = restoredSettings;
      }
    }
  } catch {
    /* A storage failure must not block entering the game. */
  }

  const refreshPalette = () => {
    palette =
      mode === 'default'
        ? null
        : {
            mode: ClientDevVisual.MODES.indexOf(mode),
            settings,
          };
  };
  refreshPalette();
  installNativePhaseBlade(api, game, resolve, (ship) => {
    if (
      !ship ||
      ship !== game.me?.ship ||
      !isClientDeveloper(game.me?.id) ||
      !ship._mc ||
      !ClientDevVisual.supportsTexture(ship.imgObj?.textureName)
    )
      return null;
    return palette;
  });

  const clear = () => {
    if (clip) {
      if (read(clip, 'style') === ownedStyle) clip.setStyle(previousStyle);
      if (read(clip, 'filter') == null) clip.set_filter(previousFilter);
    }
    clip = ownedStyle = previousStyle = previousFilter = null;
  };
  const update = () => {
    const ship = game.me?.ship;
    if (
      api.game !== game ||
      game.isLeaving ||
      mode === 'default' ||
      !isClientDeveloper(game.me?.id) ||
      !ship?._mc ||
      !ClientDevVisual.supportsTexture(ship.imgObj?.textureName)
    ) {
      clear();
      return;
    }
    if (clip !== ship._mc) {
      clear();
      styles ??= createClientDevVisualStyles(resolve);
      clip = ship._mc;
      previousStyle = read(clip, 'style');
      previousFilter = read(clip, 'filter');
      ownedStyle = new styles.ClientDevVisualStyle(ClientDevVisual.MODES.indexOf(mode), settings);
      clip.setStyle(ownedStyle);
      clip.set_filter(null);
    }
    clip.setRequiresRedraw();
  };
  const close = () => {
    const previous = popup;
    popup = null;
    if (!previous) return;
    previous.removeEventListener('accept', accept);
    previous.removeEventListener('close', close);
    if (read(previous, 'parent')) {
      const recovering = game.isRecoveringGameConnection;
      game.removeChildFromOverlay(previous, true);
      if (recovering) game.blockHotkeys = true;
    } else previous.dispose();
  };
  const apply = (nextMode: string, nextSettings: any) => {
    if (
      api.game !== game ||
      game.isLeaving ||
      game.isRecoveringGameConnection ||
      !game.me?.ship ||
      !isClientDeveloper(game.me.id)
    )
      return false;
    const normalized = ClientDevVisual.normalize(nextMode);
    const validated = ClientDevVisual.settings(nextSettings);
    if (!normalized || !validated) return false;
    const remaining = cooldown.remaining(performance.now());
    if (remaining > 0) {
      write('Wait ' + (remaining / 1000).toFixed(1) + 's before using /sv again.');
      return false;
    }
    mode = normalized;
    settings = validated;
    refreshPalette();
    clear();
    update();
    cooldown.mark(performance.now());
    try {
      api.storage.set(storageKey, { devvis: mode, devvisSettings: settings });
    } catch {
      write('Hull colors applied for this session; local storage is unavailable.');
    }
    return true;
  };
  const accept = () => {
    if (popup?.validSettings && apply(popup.selectedMode, popup.selectedSettings)) close();
  };
  const open = () => {
    if (
      popup ||
      api.game !== game ||
      game.isLeaving ||
      game.isRecoveringGameConnection ||
      !game.me?.ship ||
      !isClientDeveloper(game.me.id)
    )
      return;
    if (!Popup) {
      const bitmap = createBitmapClasses(resolve);
      const Input = createBitmapInputAdapter(api, bitmap.resolve);
      bridgeNativeProperties(Input);
      Popup = createClientDevVisualPopup(resolve, Input);
    }
    popup = new Popup({
      getExperimentalVisualOptions: () => ({ devvis: mode, devvisSettings: settings }),
      movieClip: read(game.me.ship, 'movieClip'),
    });
    popup.addEventListener('accept', accept);
    popup.addEventListener('close', close);
    game.addChildToOverlay(popup, true);
  };
  const previousOpen = Object.getOwnPropertyDescriptor(chat, 'openDevVisualPopup');
  chat.openDevVisualPopup = open;
  api.around(chat, 'sendMessage', (next, ...args) => {
    const text = read(chat.input, 'text', '').trim();
    const match = /^\/sv\s+devvis(?:\s+(.*))?$/i.exec(text);
    if (!match) return next(...args);
    if (!isClientDeveloper(game.me?.id))
      write('Developer ship visuals are available only to client developers.');
    else if (!match[1]) open();
    else if (!ClientDevVisual.normalize(match[1].trim()))
      write('Usage: /sv devvis rainbowwave|rainbowcircle|rainbow|default');
    else apply(match[1].trim(), match[1].trim().toLowerCase() === 'default' ? null : settings);
    chat.input.set_text('');
    chat.updateTab();
  });
  const ship = api.cls('core.ship.PlayerShip')?.prototype;
  if (ship)
    api.after(ship, 'draw', function () {
      if (this === game.me?.ship) update();
    });
  api.defer(installPopupKeyboard(window, () => popup !== null, close));
  api.defer(() => {
    close();
    clear();
    if (previousOpen) Object.defineProperty(chat, 'openDevVisualPopup', previousOpen);
    else delete chat.openDevVisualPopup;
  });
}
