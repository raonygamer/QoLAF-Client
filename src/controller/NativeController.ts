import { readControllers, controllerStatus } from './ControllerDevices';
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
  const hid = new DualSenseHID((error) => api.log('Controller output:', error), api.storage);
  api.defer(registerControllerContext(settings, hid));
  const reconnectHID = () => {
    void hid.restore();
  };
  reconnectHID();
  window.addEventListener('gamepadconnected', reconnectHID);
  api.defer(() => window.removeEventListener('gamepadconnected', reconnectHID));
  const input = new ControllerInput();
  let querying = false;
  let suspended = true;
  let lastState: RoamingState | null = null;
  let selectedIndex: number | null = null;
  let selectedID: string | null = null;
  const currentPad = () => {
    const pads = readControllers();
    return selectedIndex === null ? null : (pads[selectedIndex] ?? null);
  };
  installControllerFeedback(api, settings, hid, currentPad);
  installControllerHints(api, settings, currentPad);
  const clear = () => {
    input.clear();
    suspended = true;
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

  let inputBlock = 'Waiting for flight input';
  let lastStatus = '';
  let statusTime = -Infinity;
  api.on('frame', ({ game }) => {
    const now = performance.now();
    if (now - statusTime >= 1000) {
      statusTime = now;
      const status = `${controllerStatus(settings.values.enabled, settings.values.controllerIndex)}; ${inputBlock}`;
      if (status !== lastStatus) {
        lastStatus = status;
        api.log('Controller input:', status);
      }
    }
    if (game.gameStateMachine?.currentState !== lastState) {
      input.clear();
      suspended = true;
    }
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
    inputBlock = !preferences.enabled
      ? 'input off'
      : document.hidden
        ? 'document hidden'
        : !document.hasFocus()
          ? 'document unfocused'
          : this.g.get_isLeaving()
            ? 'leaving room'
            : this.g.chatInput?.isActive()
              ? 'chat active'
              : isKeyCaptureActive(this.g.get_stage())
                ? 'keyboard binding capture active'
                : editingText()
                  ? 'HTML text field active'
                  : '';
    if (inputBlock) {
      clear();
      return next();
    }
    const pads = readControllers();
    const pad =
      preferences.controllerIndex >= 0
        ? pads[preferences.controllerIndex]
        : ((selectedIndex === null ? null : pads[selectedIndex]) ??
          Array.from(pads).find((candidate) => candidate?.connected));
    if (!pad?.connected) {
      inputBlock = 'No exposed controller';
      clear();
      return next();
    }
    if (selectedIndex !== pad.index || selectedID !== pad.id) input.clear();
    inputBlock = `Reading controller ${pad.index}`;
    selectedIndex = pad.index;
    selectedID = pad.id;
    input.update(pad, preferences.mappings, preferences);
    if (suspended || lastState !== this) input.finishTick();
    suspended = false;
    lastState = this;
    querying = true;
    try {
      const player = this.me;
      const ship = player?.ship;
      if (player && !player.get_commandable() && input.isPressed(15) && player.respawnReady()) {
        player.respawnNextReady = 0;
        this.g.send('respawn');
      }
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
  if (
    !(element instanceof HTMLElement) ||
    !(element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))
  )
    return false;
  // Lime focuses an invisible 1px IME input after keyboard/mouse activity.
  // It is not an editable game field; chat and key capture have separate guards.
  const style = window.getComputedStyle(element);
  const bounds = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    style.pointerEvents !== 'none' &&
    bounds.width > 1 &&
    bounds.height > 1
  );
}
