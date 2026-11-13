import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBodyVisibility } from '../src/rendering/BodyVisibility';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';
// @ts-expect-error captured native build564 implementation
import { createBodyLifecycle } from './fixtures/NativeBodyLifecycle.js';

test('culled body detaches its sprite, keeps filter ownership and can re-enter the canvas', () => {
  class Canvas {
    children = new Set<Clip>();
    addChild(clip: Clip) {
      clip.parent?.removeChild(clip);
      clip.parent = this;
      this.children.add(clip);
    }
    removeChild(clip: Clip) {
      if (this.children.delete(clip)) clip.parent = null;
    }
  }
  class Clip {
    parent: Canvas | null = null;
    filter: { cache(): void } | null = null;
    get_filter() {
      return this.filter;
    }
    set_filter(value: { cache(): void } | null) {
      this.filter = value;
    }
    get_parent() {
      return this.parent;
    }
  }
  const canvas = new Canvas();
  class Body {
    canvas: Canvas | null = canvas;
    _mc = new Clip();
    bodyFilter = {
      disposed: false,
      cacheCalls: 0,
      cache() {
        this.cacheCalls++;
      },
    };
    g = { canvasBodies: canvas };
    isAddedToCanvas = true;
    updateIsNear() {}
    updateBody() {}
    constructor() {
      this._mc.filter = this.bodyFilter;
      canvas.addChild(this._mc);
    }
    declare removeFromCanvas: () => void;
    declare addToCanvasForReal: () => void;
    addToCanvas() {
      this.isAddedToCanvas = true;
      this.canvas?.addChild(this._mc);
    }
  }
  const base = {
    prototype: {
      removeFromCanvas(this: Body) {
        this.isAddedToCanvas = false;
        this.canvas?.removeChild(this._mc);
      },
    },
  };
  const native = createBodyLifecycle(
    base,
    { settings: { get_showEffects: () => true } },
    {},
    { caught: (error: unknown) => ({ unwrap: () => error }) },
    {
      trace: (error: unknown) => {
        throw Error(String(error));
      },
    },
    { string: String },
  );
  Object.assign(Body.prototype, native);

  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (owner: object, method: string, callback: Function) => {
    const remove = hooks.add(owner, method, kind, callback);
    cleanups.push(remove);
    return remove;
  };
  const api = {
    cls: (name: string) => (name === 'core.solarSystem.Body' ? Body : {}),
    around: hook('around'),
    before: hook('before'),
  } as unknown as API;
  bindGameClasses(api);
  installBodyVisibility(api);
  try {
    const body = new Body();
    const filter = body.bodyFilter;
    const unrelated = new Clip();
    canvas.addChild(unrelated);
    for (let cycle = 0; cycle < 3; cycle++) {
      body.removeFromCanvas();
      assert.equal(body.isAddedToCanvas, false);
      assert.equal(body._mc.get_parent(), null);
      assert.equal(body.canvas, null);
      assert.equal(body._mc.filter, null);
      assert.equal(body.bodyFilter, filter);
      assert.equal(filter.disposed, false);
      assert.deepEqual([...canvas.children], [unrelated]);
      body.removeFromCanvas();
      body.addToCanvasForReal();
      assert.equal(body._mc.get_parent(), canvas);
      assert.equal(body._mc.filter, filter);
      assert.equal(canvas.children.size, 2);
      assert.equal(filter.cacheCalls, cycle + 1, 'native re-entry rebuilds the attached filter');
    }
  } finally {
    cleanups.reverse().forEach((remove) => remove());
  }
});
