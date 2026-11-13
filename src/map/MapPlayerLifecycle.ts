import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MapPlayer, TweenMax } from '../game/Bindings';

/** Source MapPlayer visibility and tween cleanup around the native marker drawing. */
export function installMapPlayerLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  const prototype = MapPlayer.prototype;
  reflection.around(prototype, 'update', function (next) {
    const ship = this.player?.ship;
    if (!ship || !ship.alive || ship.get_landed() || ship.hp <= 0) {
      this.layer.set_visible(false);
      this.text.set_visible(false);
      this.supporterImage?.set_visible(false);
      return;
    }
    const reappearing = !this.layer.get_visible();
    const result = next();
    if (reappearing) this.supporterImage?.set_visible(true);
    return result;
  });
  reflection.before(prototype, 'dispose', function () {
    if (this.layer) TweenMax.killTweensOf(this.layer);
  });
}
