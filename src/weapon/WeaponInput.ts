import type { API } from '../api/Types';
import { PlayState, SceneBase } from '../game/Bindings';
import { cancelWeaponFire } from './WeaponCancellation';

/** Original hotkey selection and one fire-stop command per safe-zone visit. */
export function installWeaponInput(api: API): void {
  const stopped = new WeakSet<PlayState>();
  api.around(PlayState.prototype, 'handleWeaponFire', function () {
    const player = this.me;
    const ship = player?.ship;
    if (!player || !ship) return;
    this.fireWithHotkeys = false;
    let selected = 0;
    for (let input = 20; input <= 24; input++) {
      if (!this.keybinds.isInputDown(input)) continue;
      selected = input - 19;
      break;
    }
    if (selected > 0) {
      const active = this.g.hud?.weaponHotkeys?.selectedHotkey;
      if ((!active || active.key !== selected) && !ship.weaponIsChanging)
        player.sendChangeWeapon(selected);
      if (SceneBase.settings?.get_fireWithHotkeys()) this.fireWithHotkeys = true;
    }
    if (player.get_inSafeZone()) {
      this.fireWithHotkeys = false;
      for (const weapon of ship.weapons) cancelWeaponFire(weapon);
      if (!stopped.has(this)) {
        this.sendCommand(3, false);
        stopped.add(this);
      }
      return;
    }
    stopped.delete(this);
    if (!ship.get_isShooting() && (this.keybinds.isInputDown(19) || this.fireWithHotkeys))
      this.sendCommand(3, true);
    else if (ship.get_isShooting() && this.keybinds.isInputUp(19) && !this.fireWithHotkeys) {
      for (const weapon of ship.weapons) cancelWeaponFire(weapon);
      this.sendCommand(3, false);
    }
  });
}
