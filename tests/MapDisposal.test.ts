import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installMapDisposal } from '../src/map/MapDisposal';
import { Display } from './fixtures/NativeGame';

test('map cleanup returns pooled geometry before disposing remaining children and ignores late updates', () => {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanups: (() => void)[] = [];
  const order: string[] = [];
  const pool = new Display();
  class Body {
    line = new Display();
    clean() {
      assert.equal(this.line.parent, null);
      pool.addChild(this.line);
      order.push('pool');
    }
  }
  class MapView extends Display {
    static __super__ = Display;
    body = new Body();
    mapContainer = new Display();
    background = new Display();
    marker = new Display();
    clip = new Display();
    constructor() {
      super();
      this.addChild(this.background);
      this.addChild(this.mapContainer);
      this.mapContainer.addChild(this.body.line);
      this.mapContainer.addChild(this.marker);
      this.mapContainer.set_mask(this.clip);
      // Native removedFromStage dispatch is represented explicitly here.
      const remove = this.mapContainer.removeFromParent.bind(this.mapContainer);
      this.mapContainer.removeFromParent = () => {
        remove();
        this.body.clean();
        order.push('removed');
      };
    }
    update() {
      order.push('update');
    }
    dispose() {
      order.push('native');
      return 42;
    }
  }
  const classes: any = {
    'core.hud.components.map.Map': MapView,
    'core.hud.components.map.MapBodyBase': Body,
  };
  const api: any = { cls: (name: string) => classes[name] };
  for (const kind of ['before', 'around'])
    api[kind] = (target: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(target, name, kind, fn));
  installMapDisposal(api);
  try {
    const map = new MapView();
    map.update();
    assert.equal(map.dispose(), 42);
    assert.deepEqual(order, ['update', 'pool', 'removed', 'native']);
    assert.equal(map.disposed, true);
    assert.equal(map.background.disposed, true);
    assert.equal(map.mapContainer.disposed, true);
    assert.equal(map.marker.disposed, true);
    assert.equal(map.clip.disposed, true);
    assert.equal(map.body.line.disposed, false);
    assert.equal(map.body.line.parent, pool);
    map.dispose();
    map.update();
    assert.equal(order.length, 4, 'duplicate disposal and late updates do not repeat cleanup');
    assert.deepEqual(errors, []);
  } finally {
    cleanups.reverse().forEach((fn) => fn());
  }
});
