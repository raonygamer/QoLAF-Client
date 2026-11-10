import type { API, Raw } from '../api/Types';

/** GameObject.as: a canvas attachment is not proof that its pooled clip was drawn. */
export function installRenderPosition(api: API): void {
  const prototype = api.cls('core.GameObject')?.prototype;
  if (!prototype) return;
  const ready = new WeakSet<Raw>();
  const previous = Object.getOwnPropertyDescriptor(prototype, 'hasRenderPosition');
  Object.defineProperty(prototype, 'hasRenderPosition', {
    configurable: true,
    get(this: Raw) {
      return ready.has(this);
    },
  });
  api.after(prototype, 'draw', function () {
    if (this.imgObj && this._mc) ready.add(this);
  });
  for (const [name, method] of [
    ['core.GameObject', 'reset'],
    ['core.GameObject', 'addToCanvas'],
    ['core.projectile.Projectile', 'addToCanvas'],
    ['core.solarSystem.Body', 'addToCanvasForReal'],
  ]) {
    const owner = api.cls(name)?.prototype;
    if (typeof owner?.[method] === 'function')
      api.before(owner, method, function () {
        ready.delete(this);
      });
  }
  api.defer(() => {
    if (previous) Object.defineProperty(prototype, 'hasRenderPosition', previous);
    else delete prototype.hasRenderPosition;
  });
}
