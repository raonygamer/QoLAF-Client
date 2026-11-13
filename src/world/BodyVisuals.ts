import type { API } from '../api/Types';
import { Body } from '../game/Bindings';

function isInvisibleAnchor(definition: unknown): boolean {
  if (!definition || typeof definition !== 'object') return false;
  const fields = definition as Record<string, unknown>;
  return (
    (fields.type === 'hidden' || fields.type === 'boss') &&
    (fields.bitmap == null || fields.bitmap === '') &&
    fields.effect == null &&
    !fields.landable &&
    !fields.explorable &&
    !fields.canTriggerMission
  );
}

/** Original invisible-body optimization, including its lazy public sprite contract. */
export function installBodyVisuals(api: API): void {
  const deferred = new WeakSet<Body>();
  api.around(Body.prototype, 'switchTexturesByObj', function (next, definition, atlas) {
    if (!this._mc && this.obj == null && isInvisibleAnchor(definition)) {
      deferred.add(this);
      return;
    }
    return next(definition, atlas);
  });
  api.around(Body.prototype, 'get_radius', function (next) {
    return this._mc ? next() : 0.5;
  });
  api.around(Body.prototype, 'get_movieClip', function (next) {
    if (!this._mc && this.obj != null) {
      this.switchTexturesByObj(this.obj, 'texture_body.png');
    }
    return next();
  });
  api.defer(() => {
    // Native getters expect a sprite again once this plugin's hooks are gone.
    for (const body of api.game?.bodyManager?.bodies ?? []) {
      if (deferred.has(body) && !body._mc && body.obj != null)
        body.switchTexturesByObj(body.obj, 'texture_body.png');
    }
  });
}
