import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MenuSelectIcon } from '../game/Bindings';

/** Empty unlocked slots need their background for both the frame and hit area. */
export function installMenuSlotBackground(api: API): void {
  const reflection = new GameReflection(api);
  for (const setter of ['set_locked', 'set_inUse'] as const) {
    reflection.after(MenuSelectIcon.prototype, setter, function () {
      this.bgrBmp.set_visible(this._locked || !this._inUse);
    });
  }
}
