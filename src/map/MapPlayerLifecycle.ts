import { read, type API } from '../api/Types';

/** Source MapPlayer visibility and tween cleanup around the native marker drawing. */
export function installMapPlayerLifecycle(api: API): void {
  const prototype = api.cls('core.hud.components.map.MapPlayer')?.prototype;
  if (!prototype?.update) return;
  api.around(prototype, 'update', function (next, ...args) {
    const ship = this.player?.ship;
    if (!ship || !ship.alive || read(ship, 'landed') || ship.hp <= 0) {
      this.layer.set_visible(false);
      this.text.set_visible(false);
      this.supporterImage?.set_visible(false);
      return;
    }
    const reappearing = !read(this.layer, 'visible');
    const result = next(...args);
    if (reappearing) this.supporterImage?.set_visible(true);
    return result;
  });
  api.before(prototype, 'dispose', function () {
    if (this.layer) api.cls('com.greensock.TweenMax')?.killTweensOf(this.layer);
  });
}
