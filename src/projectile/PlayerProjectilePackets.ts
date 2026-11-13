import type { API } from '../api/Types';
import { EmitterFactory, Heading, ProjectileGun, ProjectileManager } from '../game/Bindings';

/** A delayed shot belongs to its packet's weapon, not the player's current selection. */
export function installPlayerProjectilePackets(api: API): void {
  api.around(ProjectileManager.prototype, 'addPlayerProjectile', function (_next, message) {
    for (let offset = 0; offset + 18 < message.length; offset += 19) {
      const id = message.getInt(offset);
      const playerId = message.getString(offset + 1);
      const weaponIndex = message.getInt(offset + 2);
      const targetId = message.getInt(offset + 3);
      const heading = new Heading();
      heading.parseMessage(message, offset + 5);
      if (id === -1) {
        EmitterFactory.create(
          'A086BD35-4F9B-5BD4-518F-4C543B2AB0CF',
          this.g,
          heading.pos.x | 0,
          heading.pos.y | 0,
          null,
          true,
        );
        return;
      }
      const player = this.g.playerManager?.get_playersById().h[playerId];
      const ship = player?.ship;
      if (!ship?.weapons || weaponIndex < 0 || weaponIndex >= ship.weapons.length) return;
      const weapon = ship.weapons[weaponIndex];
      if (!(weapon instanceof ProjectileGun) || this.skipWhileStalled(weapon)) continue;
      const target = targetId === -1 ? null : this.g.unitManager.getTarget(targetId);
      weapon.shootSyncedProjectile(
        id,
        target,
        heading,
        message.getInt(offset + 15),
        message.getNumber(offset + 4),
        message.getInt(offset + 16),
        message.getInt(offset + 17),
        message.getNumber(offset + 18),
      );
    }
  });
}
