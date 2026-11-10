import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuraLightningFrames } from '../src/rendering/AuraLightningFrames';
import { Display } from './fixtures/NativeGame';
import type { Raw } from '../src/api/Types';

class Lightning extends Display {
  anchors: unknown;
  calls: any[][] = [];
  setAnchors(points: unknown) {
    this.anchors = points;
  }
  advance(...args: any[]) {
    this.calls.push(args);
    this.set_alpha(1);
    this.set_visible(true);
  }
  set_rotation(value: number) {
    this.rotation = value;
  }
}

class Outline extends Lightning {
  setContours(points: unknown) {
    this.anchors = points;
  }
}

test('lightning follows the strongest rendered pulse and hides on disabled, stopped or offscreen frames', () => {
  const settings = { disableRemasteredAuras: false };
  const points = [
    [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ],
  ];
  const frames = new AuraLightningFrames(
    { cls: () => ({ clientSettings: settings }) } as any,
    Lightning,
    { points: () => points } as any,
    Outline,
    { contours: () => points } as any,
  );
  const parent = new Display();
  const owner = parent.addChild(new Display());
  const clip = owner.addChild(new Display());
  clip.set_alpha(0.4);
  const layer = parent.addChild(new Display());
  const emitter: Raw = {
    target: { movieClip: clip, auraDisplayObject: owner },
    g: { isLeaving: false },
    isEmitting: true,
    isOnScreen: true,
    collectiveMeshBatch: { parent: layer },
  };
  const particle = {
    texture: { width: 80, height: 40 },
    scaleX: -2,
    scaleY: 3,
    x: 12,
    y: 34,
    rotation: 0.5,
    color: 0x4488ff,
    startAlpha: 0.8,
  };
  frames.prepare(emitter, 5);
  frames.begin(emitter);
  frames.observe(emitter, { ...particle, x: 100 }, 0.2);
  frames.observe(emitter, particle, 0.7);
  frames.observe(emitter, { ...particle, x: 200 }, 0.3);
  frames.finish(emitter, 5.5);
  const mesh = layer.children[0] as Lightning;
  const outline = layer.children[1] as Outline;
  assert.equal(outline.anchors, points);
  assert.deepEqual(outline.calls[0], [5.5, 80, 60, 0x4488ff, 8, 3, 0.3125 / 16]);
  assert.equal(outline.get_x(), 12);
  assert.ok(Math.abs(outline.get_alpha() - 0.35) < 1e-10);
  assert.equal(mesh.anchors, points);
  assert.deepEqual(mesh.calls[0], [5.5, 80, 60, 0x4488ff, 8, 3, 0.3125]);
  assert.equal(mesh.get_x(), 12);
  assert.equal(mesh.get_y(), 34);
  assert.equal(mesh.get_scaleX(), -1);
  assert.equal(mesh.get_scaleY(), 1);
  assert.ok(Math.abs(mesh.get_alpha() - 0.35) < 1e-10);
  for (const condition of ['disabled', 'stopped', 'offscreen', 'leaving', 'hidden', 'noParticle']) {
    settings.disableRemasteredAuras = condition === 'disabled';
    emitter.isEmitting = condition !== 'stopped';
    emitter.isOnScreen = condition !== 'offscreen';
    emitter.g.isLeaving = condition === 'leaving';
    layer.set_visible(condition !== 'hidden');
    frames.begin(emitter);
    if (condition !== 'noParticle') frames.observe(emitter, particle, 0.7);
    frames.finish(emitter, 5.5);
    assert.equal(outline.get_visible(), false, condition);
    assert.equal(outline.calls.length, 1, condition);
    assert.equal(mesh.get_visible(), false, condition);
    assert.equal(mesh.calls.length, 1, condition);
  }
  frames.release(emitter);
  frames.release(emitter);
  assert.equal(mesh.disposed, true);
  assert.equal(outline.disposed, true);
  assert.equal(layer.children.length, 0);
});
