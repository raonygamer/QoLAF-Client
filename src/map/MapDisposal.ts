import { read, type API, type Raw } from '../api/Types';

/** Complete the source map teardown after the native marker-specific cleanup. */
export function installMapDisposal(api: API): void {
  const MapClass = api.cls('core.hud.components.map.Map');
  const prototype = MapClass?.prototype;
  const disposeContainer = MapClass?.__super__?.prototype.dispose;
  if (!prototype?.dispose || typeof disposeContainer !== 'function') return;
  const disposed = new WeakSet<Raw>();
  api.around(prototype, 'dispose', function (next, ...args) {
    if (disposed.has(this)) return;
    disposed.add(this);
    // Removal delivers native removedFromStage cleanup before pooled objects
    // and their remaining display parents are disposed.
    const container = this.mapContainer;
    container?.removeFromParent();
    const result = next(...args);
    const mask = read(container, 'mask');
    container?.set_mask(null);
    mask?.dispose();
    container?.dispose();
    disposeContainer.call(this);
    return result;
  });
  api.around(prototype, 'update', function (next, ...args) {
    if (!disposed.has(this)) return next(...args);
  });
  const body = api.cls('core.hud.components.map.MapBodyBase')?.prototype;
  if (body?.clean)
    api.before(body, 'clean', function () {
      this.line.removeFromParent();
    });
}
