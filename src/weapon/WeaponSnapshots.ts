import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Beam, Teleport, PlayerManager, type Player, type Weapon } from '../game/Bindings';
import type { WeaponSelection } from './WeaponSelection';

function stopWeapon(weapon: Weapon | undefined): void {
  if (!weapon) return;
  if (weapon.get_fire()) weapon.set_fire(false);
  weapon.target = null;
}

/** Source packet bounds and selection arbitration, retaining native wire fields. */
export function installWeaponSnapshots(
  api: API,
  selection: (player: Player) => WeaponSelection,
): void {
  const reflection = new GameReflection(api);
  reflection.around(
    PlayerManager.prototype,
    'fire',
    function (_next, message, offset = 0, length = 0) {
      const end = length > 0 ? Math.min(message.length, offset + length - 2) : message.length;
      const player = this.get_playersById().h[message.getString(offset)];
      const ship = player?.ship;
      if (!player || !ship) return;
      const index = message.getInt(offset + 1);
      const firing = message.getBoolean(offset + 2);
      const targetId = end > offset + 3 ? message.getInt(offset + 3) : -1;
      const target = targetId === -1 ? null : this.g.unitManager.getTarget(targetId);
      if (end > offset + 4) {
        if (!ship.weaponHeat) return;
        ship.weaponHeat.setHeat(message.getNumber(offset + 4));
      }
      const weapon = index >= 0 ? ship.weapons[index] : undefined;
      if (!selection(player).acceptReceived(index)) {
        if (weapon !== ship.get_weapon()) stopWeapon(weapon);
        return;
      }
      if (!weapon) return;
      for (const other of ship.weapons) if (other !== weapon) stopWeapon(other);
      if (weapon.get_fire() !== firing) weapon.set_fire(firing);
      weapon.target = target;
      if (weapon instanceof Beam) {
        weapon.secondaryTargets = [];
        for (let cursor = offset + 5; cursor < end; cursor++) {
          // Current Haxe packets terminate beam targets at the first non-integer.
          if (message.kindAt(cursor) !== 0) break;
          const secondary = this.g.unitManager.getTarget(message.getInt(cursor));
          if (secondary) weapon.secondaryTargets.push(secondary);
        }
      } else if (end > offset + 5 && !(weapon instanceof Teleport)) {
        weapon.reloadTime = message.getNumber(offset + 5);
      }
    },
  );
  reflection.around(PlayerManager.prototype, 'onPlayerUpdate', function (_next, message) {
    const player = this.get_playersById().h[message.getString(0)];
    const ship = player?.ship;
    if (!player || !ship) return;
    ship.hp = message.getInt(1);
    ship.shieldHp = message.getInt(2);
    if (ship.hp < ship.get_hpMax() || ship.shieldHp < ship.get_shieldHpMax()) ship.isInjured = true;
    if (message.length <= 3) return;
    const index = message.getInt(3);
    const weapon = index >= 0 ? ship.weapons[index] : undefined;
    if (player.isMe && !selection(player).acceptReceived(index)) {
      if (ship.weaponHeat && message.length > 4) ship.weaponHeat.setHeat(message.getNumber(4));
      if (weapon !== ship.get_weapon()) stopWeapon(weapon);
      return;
    }
    let selected: Weapon | undefined;
    if (weapon) {
      selected = weapon;
      player.selectedWeaponIndex = index;
      ship.weaponHeat?.setHeat(message.getNumber(4));
      const firing = message.getBoolean(5);
      const targetId = message.getInt(6);
      weapon.target = targetId === -1 ? null : this.g.unitManager.getTarget(targetId);
      if (weapon.get_fire() !== firing) weapon.set_fire(firing);
    }
    for (const other of ship.weapons) if (other !== selected) stopWeapon(other);
  });
}
