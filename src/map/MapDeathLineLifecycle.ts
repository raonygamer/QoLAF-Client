import type { API } from '../api/Types';

/** Source MapDeathLine detaches its display object before returning the pooled line. */
export function installMapDeathLineLifecycle(api: API): void {
  const prototype = api.cls('core.hud.components.map.MapDeathLine')?.prototype;
  if (!prototype?.dispose) return;
  api.before(prototype, 'dispose', function () {
    this.line.removeFromParent();
  });
}
