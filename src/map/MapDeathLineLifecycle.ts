import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MapDeathLine } from '../game/Bindings';

/** Source MapDeathLine detaches its display object before returning the pooled line. */
export function installMapDeathLineLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  reflection.before(MapDeathLine.prototype, 'dispose', function () {
    this.line.removeFromParent();
  });
}
