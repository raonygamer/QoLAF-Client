import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  StarlingTextField as TextField,
  DisplayObjectContainer as Container,
  Starling,
} from '../game/Bindings';

/** Keep HTML geometry changes outside Starling's cached display-list traversal. */
export function installBitmapCompositionQueue(api: API): void {
  const reflection = new GameReflection(api);
  const pending = new Set<TextField>();
  let painting = false;
  const compose = (field: TextField) => {
    if (field._recomposing || !field.get_isHtmlText()) return;
    if (!field._requiresRecomposition) return;
    if (painting || !field._meshBatch) pending.add(field);
    else field.recompose();
  };
  reflection.after(TextField.prototype, 'setRequiresRecomposition', function () {
    compose(this);
  });
  reflection.before(Container.prototype, 'addChildAt', function (child) {
    if (child instanceof TextField) compose(child);
  });
  reflection.before(TextField.prototype, 'dispose', function () {
    pending.delete(this);
  });
  reflection.around(Starling.prototype, 'render', function (next, ...args) {
    const current = [...pending];
    pending.clear();
    for (const field of current) compose(field);
    painting = true;
    try {
      return next(...args);
    } finally {
      painting = false;
    }
  });
  reflection.around(TextField.prototype, 'render', function (next, painter) {
    if (pending.has(this)) {
      // A field changed during traversal. Draw it after next frame's
      // composition instead of caching a range whose geometry is changing.
      painter.excludeFromCache(this);
      return;
    }
    return next(painter);
  });
  api.defer(() => pending.clear());
}
