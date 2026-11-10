import { read, type API, type Raw } from '../Api/Types';

/** Keep HTML geometry changes outside Starling's cached display-list traversal. */
export function installBitmapCompositionQueue(api: API): void {
  const TextField = api.cls('starling.text.TextField')!;
  const Container = api.cls('starling.display.DisplayObjectContainer')!;
  const Starling = api.cls('starling.core.Starling')!;
  const pending = new Set<Raw>();
  let painting = false;
  const compose = (field: Raw) => {
    if (field._recomposing || !read(field, 'isHtmlText', false)) return;
    if (!field._requiresRecomposition) return;
    if (painting || !field._meshBatch) pending.add(field);
    else field.recompose();
  };
  api.after(TextField.prototype, 'setRequiresRecomposition', function () {
    compose(this);
  });
  api.before(Container.prototype, 'addChildAt', function (child) {
    if (child instanceof (TextField as any)) compose(child);
  });
  api.before(TextField.prototype, 'dispose', function () {
    pending.delete(this);
  });
  api.around(Starling.prototype, 'render', function (next, ...args) {
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
  api.around(TextField.prototype, 'render', function (next, painter) {
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
