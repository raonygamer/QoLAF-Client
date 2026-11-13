import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuraRenderLayer } from '../src/rendering/AuraRenderLayer';
import { installRarityAuraLayers } from '../src/rendering/RarityAuraLayers';
import { Display } from './fixtures/NativeGame';
import type { Raw } from '../src/api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

class Sprite extends Display {
  set_transformationMatrix(matrix: Raw) {
    this.matrix = { ...matrix };
  }
}
class Matrix {}
function scene() {
  const parent = new Sprite();
  const owner = parent.addChild(new Sprite());
  const foreground = parent.addChild(new Sprite());
  const effects = new Sprite();
  effects.getTransformationMatrix = (destination: Raw, result: Raw) => {
    assert.equal(destination, owner.parent);
    Object.assign(result, { a: 2, b: 0, c: 0, d: 2, tx: 17.5, ty: -6.25 });
    return result;
  };
  return { parent, owner, foreground, effects };
}

test('aura layers follow source ordering, world transform and owner visibility without reordering each other', () => {
  const { parent, owner, foreground, effects } = scene();
  const first = new AuraRenderLayer(Sprite, Matrix);
  const second = new AuraRenderLayer(Sprite, Matrix);
  first.sync(owner, effects);
  second.sync(owner, effects);
  assert.deepEqual(parent.children, [owner, second.display, first.display, foreground]);
  const order = [...parent.children];
  for (let i = 0; i < 10; i++) {
    first.sync(owner, effects);
    second.sync(owner, effects);
  }
  assert.deepEqual(parent.children, order);
  assert.deepEqual(first.display.matrix, { a: 2, b: 0, c: 0, d: 2, tx: 17.5, ty: -6.25 });
  assert.equal(first.display.get_touchable(), false);
  owner.set_alpha(0.25);
  owner.set_visible(false);
  first.sync(owner, effects);
  assert.equal(first.display.get_alpha(), 0.25);
  assert.equal(first.display.get_visible(), false);
  owner.set_visible(true);
  effects.set_visible(false);
  first.sync(owner, effects);
  assert.equal(first.display.get_visible(), false);
  effects.set_visible(true);
  const other = new Sprite();
  other.addChild(owner);
  first.sync(owner, effects);
  assert.deepEqual(other.children, [owner, first.display]);
  assert.equal(first.display.get_visible(), true);
  owner.removeFromParent();
  first.sync(owner, effects);
  assert.equal(first.display.parent, null);
  assert.equal(first.display.get_visible(), false);
  first.dispose();
  second.dispose();
  assert.equal(first.display.disposed, true);
});

test('rarity owns its batch, releases on death/pool cleanup and restores native batching on unload', () => {
  const { owner, effects } = scene();
  class Emitter {
    alive = true;
    target = { get_movieClip: () => owner };
    g = { canvasEffects: effects };
    collectiveMeshBatch: Raw;
    nativeParents = 0;
    constructor() {
      this.collectiveMeshBatch = shared;
    }
    setBatchParent() {
      this.nativeParents++;
    }
    dispose() {
      this.collectiveMeshBatch = null as any;
    }
  }
  let removals = 0;
  const shared = {
    remove() {
      removals++;
    },
    set_blendMode() {},
  };
  class MeshBatch extends Sprite {
    vertices = 0;
    clear() {
      this.vertices = 0;
    }
  }
  const collective = { disposeAll() {}, Create: () => shared };
  const factory = { createRareType: (emitters: Emitter[] | null) => emitters };
  const classes: Raw = {
    'core.particle.EmitterFactory': factory,
    'core.particle.Emitter': Emitter,
    'core.particle.CollectiveMeshBatch': collective,
    'starling.display.MeshBatch': MeshBatch,
    'starling.display.Sprite': Sprite,
    'openfl.geom.Matrix': Matrix,
  };
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => classes[name],
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    after: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
    defer: (fn: () => void) => cleanups.push(fn),
  } as any;
  const prepareFrame = installRarityAuraLayers(api)!;
  try {
    assert.equal(factory.createRareType(null), null);
    const emitter = new Emitter();
    factory.createRareType([emitter]);
    const batch = emitter.collectiveMeshBatch;
    const layer = batch.parent;
    assert.equal(batch.get_blendMode(), 'add');
    assert.equal(batch.get_batchable(), false);
    assert.equal(removals, 1);
    factory.createRareType([emitter]);
    assert.equal(
      emitter.collectiveMeshBatch,
      batch,
      'repeat preparation does not leak another batch',
    );
    emitter.setBatchParent();
    assert.equal(emitter.nativeParents, 0);
    batch.vertices = 4;
    emitter.setBatchParent();
    assert.equal(batch.vertices, 4, 'parent synchronization preserves this frame’s particles');
    owner.set_visible(false);
    prepareFrame(emitter); // Includes frames that cull or early-return before drawing.
    assert.equal(layer.get_visible(), false);
    assert.equal(batch.vertices, 0, 'a skipped draw cannot retain the previous frame’s particles');
    batch.remove({});
    assert.equal(batch.disposed, false);
    batch.remove(emitter);
    batch.remove(emitter);
    assert.equal(batch.disposed, true);
    assert.equal(layer.disposed, true);
    emitter.dispose();
    emitter.collectiveMeshBatch = shared;
    factory.createRareType([emitter]);
    const next = emitter.collectiveMeshBatch;
    batch.remove(emitter);
    assert.equal(
      next.disposed,
      false,
      "a retired batch cannot release a pooled emitter's new layer",
    );
    collective.disposeAll();
    assert.equal(next.disposed, true);
    emitter.collectiveMeshBatch = shared;
    factory.createRareType([emitter]);
    const finalBatch = emitter.collectiveMeshBatch;
    cleanups.reverse().forEach((fn) => fn());
    cleanups.length = 0;
    assert.equal(finalBatch.disposed, true);
    assert.equal(emitter.collectiveMeshBatch, shared);
    assert.equal(emitter.nativeParents, 1);
  } finally {
    cleanups.reverse().forEach((fn) => fn());
  }
});
