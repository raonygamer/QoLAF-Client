import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host JavaScript fixture
import { Hooks } from './fixtures/HostCore.js';
import { installBitmapCompositionQueue } from '../src/ui/BitmapCompositionQueue';

test('HTML composition stays outside cached traversal and cancels deferred work on disposal', () => {
  const order: string[] = [];
  const errors: unknown[] = [];
  const cleanups: (() => void)[] = [];
  class TextField {
    _meshBatch = {};
    _requiresRecomposition = true;
    _recomposing = false;
    html = true;
    get_isHtmlText() {
      return this.html;
    }
    setRequiresRecomposition() {
      this._requiresRecomposition = true;
    }
    recompose() {
      order.push('compose');
      this._requiresRecomposition = false;
    }
    render(_painter: any) {
      order.push('field');
    }
    dispose() {}
  }
  class Container {
    addChildAt(_child: unknown, _index: number) {}
  }
  let duringRender: (() => void) | null = null;
  class Starling {
    render() {
      order.push('render');
      duringRender?.();
    }
  }
  const classes: any = {
    'starling.text.TextField': TextField,
    'starling.display.DisplayObjectContainer': Container,
    'starling.core.Starling': Starling,
  };
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: () => void) => cleanups.push(fn),
  };
  for (const kind of ['before', 'after', 'around'])
    api[kind] = (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, kind, fn));
  try {
    installBitmapCompositionQueue(api);
    const field = new TextField();
    new Container().addChildAt(field, 0);
    assert.deepEqual(order, ['compose'], 'compose before adding the HTML field');
    order.length = 0;
    duringRender = () => {
      field.setRequiresRecomposition();
      field.setRequiresRecomposition();
      field.render({
        excludeFromCache() {
          order.push('exclude');
        },
      });
    };
    new Starling().render();
    assert.deepEqual(order, ['render', 'exclude']);
    order.length = 0;
    duringRender = null;
    new Starling().render();
    assert.deepEqual(order, ['compose', 'render'], 'deferred changes compose only once');
    order.length = 0;
    duringRender = () => {
      field.setRequiresRecomposition();
      field.dispose();
    };
    new Starling().render();
    duringRender = null;
    new Starling().render();
    assert.deepEqual(order, ['render', 'render'], 'disposed fields leave the queue');
    order.length = 0;
    const plain = new TextField();
    plain.html = false;
    new Container().addChildAt(plain, 0);
    plain.setRequiresRecomposition();
    new Starling().render();
    assert.deepEqual(order, ['render']);
    assert.deepEqual(errors, []);
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup();
  }
});
