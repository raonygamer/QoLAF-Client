import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installEmitterMirroring } from '../src/rendering/EmitterMirroring';
import type { Raw } from '../src/api/Types';
// @ts-expect-error inspected upstream factory
import makeFactory from './fixtures/UpstreamEmitterFactory.js';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('native self factory preserves absolute hull scale, authored size signs and pooled reflection', () => {
  class Emitter {
    dispose() {}
  }
  const emitter: Raw = new Proxy(new Emitter() as Raw, {
    get(object, key: string) {
      if (key.startsWith('set_')) return (value: unknown) => (object[key.slice(4)] = value);
      if (key.startsWith('get_')) return () => object[key.slice(4)];
      return object[key];
    },
  });
  const definition = { bitmap: 'self', startSize: 2, finishSize: 3 };
  const data = { loadKey: () => ({ emitters: [definition] }) };
  const factory = makeFactory(
    { getService: () => data },
    {},
    {
      core_particle_Emitter: Emitter,
      generics_Color: { fixColorCode: (color: number) => color },
      core_particle_CollectiveMeshBatch: { Create: () => ({ set_blendMode() {} }) },
    },
  );
  factory.resolveTexture = () => ({});
  const game = {
    get_isLeaving: () => false,
    emitterManager: { getEmitter: () => emitter },
    dataManager: data,
  };
  const clip = {
    scaleX: -2,
    scaleY: 3,
    get_scaleX() {
      return this.scaleX;
    },
    get_scaleY() {
      return this.scaleY;
    },
  };
  const target: Raw = { get_movieClip: () => clip };
  const create = () => factory.create('effect', game, 0, 0, target);
  create();
  assert.equal(emitter.startSize, -4, 'native baseline multiplies signed scale');
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  installEmitterMirroring({
    cls: (name: string) => (name === 'core.particle.Emitter' ? Emitter : factory),
    after: (object: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'after', fn)),
    before: (object: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'before', fn)),
  } as any);
  try {
    for (const [x, y, mirrored] of [
      [-2, 3, true],
      [2, -3, true],
      [-2, -3, false],
      [2, 3, false],
    ] as const) {
      clip.scaleX = x;
      clip.scaleY = y;
      create();
      assert.equal(emitter.startSize, 4);
      assert.equal(emitter.finishSize, 6);
      assert.equal(emitter.mirrorY, mirrored);
    }
    target.get_renderMirrored = () => true; // Multipart target's composed transform wins.
    create();
    assert.equal(emitter.mirrorY, true);
    emitter.dispose();
    assert.equal(emitter.mirrorY, false);
    definition.bitmap = 'other';
    create();
    assert.equal(emitter.mirrorY, false);
    assert.equal(emitter.startSize, 2);
    definition.bitmap = 'self';
    definition.startSize = -2;
    clip.scaleX = -2;
    create();
    assert.equal(emitter.startSize, -4, 'retain authored signs independently of hull reflection');
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});
