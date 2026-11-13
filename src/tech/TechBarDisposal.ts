import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Sprite, TechBar } from '../game/Bindings';

/** Match the original client: the container owns its icons' disposal. */
export function installTechBarDisposal(api: API): void {
  const disposed = new WeakSet<TechBar>();
  new GameReflection(api).around(TechBar.prototype, 'dispose', function () {
    if (disposed.has(this)) return;
    disposed.add(this);
    this.removeEventListeners();
    // Native TechBar disposes each icon itself, then Sprite disposes the same
    // children again. Delegate once to the container, including the elite icon.
    Sprite.prototype.dispose.call(this);
    this.techIcons = null;
    this.eliteTechIcon = null;
    this.eti = null;
  });
}
