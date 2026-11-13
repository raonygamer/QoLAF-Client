import { installWeaponSelectionAPI } from './WeaponSelectionAPI';
import { WeaponSelection } from './WeaponSelection';
import { installWeaponSnapshots } from './WeaponSnapshots';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Player, PlayerManager } from '../game/Bindings';

/** Original changeWeapon validates live slots and clears live firing latches. */
export function installWeaponAcknowledgement(api: API): void {
  const reflection = new GameReflection(api);
  const selections = new WeakMap<Player, WeaponSelection>();
  const selection = (player: Player) => {
    let value = selections.get(player);
    if (!value) {
      value = new WeaponSelection(player);
      selections.set(player, value);
    }
    return value;
  };
  installWeaponSelectionAPI(api, selection);
  reflection.around(Player.prototype, 'sendChangeWeapon', function (_next, hotkey) {
    this.requestWeaponChange(hotkey);
  });
  reflection.around(PlayerManager.prototype, 'weaponChangeFailed', function (_next, message) {
    const player = this.get_playersById().h[message.getString(0)];
    if (player) selection(player).failed();
  });
  installWeaponSnapshots(api, selection);
  reflection.around(Player.prototype, 'changeWeapon', function (next, message, offset) {
    const ship = this.ship;
    if (!ship) {
      selection(this).acknowledge(-1);
      return next(message, offset);
    }
    for (const weapon of ship.weapons) {
      if (weapon && weapon.get_fire()) weapon.set_fire(false);
    }
    const index = message.getInt(offset + 1);
    const weapon = index >= 0 ? ship.weapons[index] : undefined;
    if (
      !weapon ||
      (this.isMe &&
        (!weapon.active || weapon.hotkey <= 0 || weapon.hotkey > this.unlockedWeaponSlots))
    ) {
      selection(this).failed();
      return;
    }
    // Keep native loadout persistence and HUD selection, including new-game data.
    const result = next(message, offset);
    selection(this).acknowledge(index);
    return result;
  });
}
