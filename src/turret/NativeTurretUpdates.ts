import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { TurretManager, type Turret } from '../game/Bindings';
import { TurretIndex } from './TurretIndex';

export function installNativeTurretUpdates(api: API): void {
  const reflection = new GameReflection(api);
  const indexes = new WeakMap<TurretManager, TurretIndex<Turret>>();
  const index = (manager: TurretManager) => {
    let result = indexes.get(manager);
    if (!result) {
      result = new TurretIndex(
        () => manager.turrets,
        (turret) => turret.get_id(),
        (turret) => turret.parentObj?.get_id() ?? null,
        (turret) => turret.syncId,
      );
      indexes.set(manager, result);
    }
    return result;
  };
  reflection.around(TurretManager.prototype, 'getTurretById', function (next, id, silent) {
    return index(this).findId(id, () => next(id, silent));
  });
  reflection.around(
    TurretManager.prototype,
    'getTurretsByParentAndSyncId',
    function (next, parent, sync) {
      return index(this).findParent(parent, sync, () => next(parent, sync));
    },
  );
  reflection.after(TurretManager.prototype, 'getTurret', function (turret) {
    indexes.get(this)?.added(turret);
  });
  reflection.after(TurretManager.prototype, 'removeTurret', function (_result, turret) {
    indexes.get(this)?.removed(turret);
  });
  reflection.around(TurretManager.prototype, 'onTurretUpdate', function (_next, message) {
    const turret = this.getTurretById(message.getInt(0));
    if (!turret) return;
    turret.hp = message.getInt(1);
    turret.shieldHp = message.getInt(2);
    if (turret.hp < turret.get_hpMax() || turret.shieldHp < turret.get_shieldHpMax())
      turret.isInjured = true;
    turret.target = this.g.shipManager.getShipFromId(message.getInt(3));
    // Initial sync still sets rotation. Subsequent updates must not fight AITurret.
    message.getNumber(4);
    turret.weapon?.set_fire(message.getBoolean(5));
  });
}
