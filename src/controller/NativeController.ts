import { installControllerHints } from './NativeControllerHints';
import { registerControllerContext } from './ControllerContext';
import { installControllerMenu } from './NativeControllerMenu';
import { isControllerCaptureActive } from './ControllerCapture';
import { installControllerFeedback } from './NativeControllerFeedback';
import { DualSenseHID } from './DualSenseHID';
import type { API } from '../api/Types';
import { KeyBinds, RoamingState } from '../game/Bindings';
import { isKeyCaptureActive } from '../settings/KeyCapture';
import { ControllerInput, cycleWeapon } from './ControllerInput';
import { ControllerSettings, nextWeaponAction, previousWeaponAction } from './ControllerSettings';

/** Feed native input queries; commands, boost timing and movement remain game-owned. */
export function installNativeController(api: API): void {
  const settings = new ControllerSettings(api.storage);
  installControllerMenu(api, settings, isControllerCaptureActive);
  const hid = new DualSenseHID((error) => api.log('Controller output:', error));
  api.defer(registerControllerContext(settings, hid));
  const input = new ControllerInput();
  let querying = false;
  let selectedIndex: number | null = null;
  let selectedID: string | null = null;
  const currentPad = () => {
    const pads = navigator.getGamepads?.() ?? [];
    return selectedIndex === null ? null : (pads[selectedIndex] ?? null);
  };
  installControllerFeedback(api, settings, hid, currentPad);
  installControllerHints(api, settings, currentPad);
  const clear = () => {
    input.clear();
    querying = false;
    selectedIndex = null;
    selectedID = null;
  };
  const resetFeedback = () => {
    void hid.reset();
  };
  window.addEventListener('blur', resetFeedback);
  window.addEventListener('blur', clear);
  window.addEventListener('gamepaddisconnected', clear);
  api.defer(() => {
    clear();
    window.removeEventListener('blur', clear);
    window.removeEventListener('gamepaddisconnected', clear);
    window.removeEventListener('blur', resetFeedback);
    void hid.dispose();
    settings.save();
  });

  api.around(KeyBinds.prototype, 'isInputDown', function (next, action) {
    return (querying && input.isDown(action)) || next(action);
  });
  api.around(KeyBinds.prototype, 'isInputPressed', function (next, action) {
    return (querying && input.isPressed(action)) || next(action);
  });
  api.around(KeyBinds.prototype, 'isInputUp', function (next, action) {
    return !(querying && input.isDown(action)) && next(action);
  });

  api.around(RoamingState.prototype, 'updateInput', function (next) {
    const preferences = settings.values;
    if (
      !preferences.enabled ||
      document.hidden ||
      !document.hasFocus() ||
      this.g.get_isLeaving() ||
      this.g.chatInput?.isActive() ||
      isKeyCaptureActive(this.g.get_stage()) ||
      editingText()
    ) {
      clear();
      return next();
    }
    const pads = navigator.getGamepads?.() ?? [];
    const pad =
      preferences.controllerIndex >= 0
        ? pads[preferences.controllerIndex]
        : ((selectedIndex === null ? null : pads[selectedIndex]) ??
          Array.from(pads).find((candidate) => candidate?.connected));
    if (!pad?.connected) {
      clear();
      return next();
    }
    if (selectedIndex !== pad.index || selectedID !== pad.id) input.clear();
    selectedIndex = pad.index;
    selectedID = pad.id;
    input.update(pad, preferences.mappings, preferences);
    querying = true;
    try {
      const player = this.me;
      const ship = player?.ship;
      if (player && ship && player.get_commandable() && !ship.weaponIsChanging) {
        const previous = input.isPressed(previousWeaponAction);
        const forward = input.isPressed(nextWeaponAction);
        if (previous !== forward) {
          const hotkey = cycleWeapon(
            ship.weapons.filter((weapon) => weapon.active).map((weapon) => weapon.hotkey),
            this.g.hud?.weaponHotkeys?.selectedHotkey?.key ?? 0,
            forward ? 1 : -1,
          );
          if (hotkey !== null) player.sendChangeWeapon(hotkey);
        }
      }
      return next();
    } finally {
      querying = false;
      input.finishTick();
    }
  });
}

function editingText(): boolean {
  const element = document.activeElement;
  return (
    element instanceof HTMLElement &&
    (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))
  );
}
