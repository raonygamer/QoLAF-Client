import { read, type API } from '../api/Types';

/** EnemyShip.as positions AF/pet names after the interpolated ship draw. */
export function installWorldLabels(api: API): void {
  const enemy = api.cls('core.ship.EnemyShip')?.prototype;
  if (typeof enemy?.draw !== 'function') return;
  api.after(enemy, 'draw', function () {
    const label = this.AFName;
    const clip = this._mc;
    if (!label || !clip || !this.isAddedToCanvas) return;
    label.set_x(read(clip, 'x'));
    label.set_y(read(clip, 'y') - 30);
  });
}
