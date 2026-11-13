import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { EnemyShip } from '../game/Bindings';

/** EnemyShip.as positions AF/pet names after the interpolated ship draw. */
export function installWorldLabels(api: API): void {
  const reflection = new GameReflection(api);
  reflection.after(EnemyShip.prototype, 'draw', function () {
    const label = this.AFName;
    const clip = this._mc;
    if (!label || !clip || !this.isAddedToCanvas) return;
    label.set_x(clip.get_x());
    label.set_y(clip.get_y() - 30);
  });
}
