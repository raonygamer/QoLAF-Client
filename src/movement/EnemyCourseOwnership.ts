import type { API } from '../api/Types';
import { Converger, EnemyShip, Point } from '../game/Bindings';

/** Original Heading.copy ownership, retaining the updated native blend/lead calculation. */
export function installEnemyCourseOwnership(api: API): void {
  api.before(Converger.prototype, 'aiAddError', function (heading) {
    const target = this.target;
    if (!(this.ship instanceof EnemyShip) || !target || heading === target) return;
    // Native setConvergeTarget assigns these references immediately before
    // aiAddError. Detach before applying its visual correction to the course.
    if (heading.pos === target.pos) heading.pos = new Point(target.pos.x, target.pos.y);
    if (heading.speed === target.speed) heading.speed = new Point(target.speed.x, target.speed.y);
  });
}
