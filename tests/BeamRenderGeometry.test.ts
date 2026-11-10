import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BeamRenderGeometry, getActiveBeamGeometry } from '../src/weapon/BeamRenderGeometry';
import { installNativeBeamGeometry } from '../src/weapon/NativeBeamGeometry';
import { writePhaseBladeMounts } from '../src/weapon/PhaseBladeMounts';
// @ts-expect-error official native beam fixture
import createBeamClasses from './fixtures/UpstreamBeam.js';

function weapon() {
  return {
    unit: {
      isAddedToCanvas: true,
      weaponPos: { x: 10, y: 0 },
      x: 100,
      y: 200,
      rotation: 0,
      _mc: { x: 110, y: 210, rotation: Math.PI / 2 },
    },
    positionOffsetX: 0,
    positionOffsetY: 0,
    twin: true,
    twinOffset: 3,
    range: 100,
    startPos: { x: 1, y: 2 },
    startPos2: { x: 3, y: 4 },
    endPos: { x: 5, y: 6 },
    target: null as any,
    targetBody: null as any,
    startEffect: [{} as any],
    startEffect2: [{ isEmitting: true }],
    endEffect: [{} as any],
  };
}
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('beam muzzle and endpoints advance with rendered poses without simulation updates at 60/120/180 FPS', () => {
  for (const fps of [60, 120, 180]) {
    const beam = weapon(),
      view = new BeamRenderGeometry();
    beam.target = { alive: true, x: 500, y: 600, _mc: { x: 510, y: 610 } };
    const native = JSON.stringify([
      beam.startPos,
      beam.startPos2,
      beam.endPos,
      beam.unit.x,
      beam.target.x,
    ]);
    for (let frame = 0; frame < fps; frame++) {
      beam.unit._mc.x = 110 + (frame / fps) * 30;
      beam.target._mc.x = 510 + (frame / fps) * 60;
      view.update(beam);
      view.updateEmitters(beam);
      near(view.start.x, 107 + (frame / fps) * 30);
      near(view.start.y, 220);
      near(view.second.x, 113 + (frame / fps) * 30);
      near(view.end.x, 510 + (frame / fps) * 60);
      near(beam.startEffect[0].posX, view.start.x);
      near(beam.endEffect[0].posX, view.end.x);
      assert.equal(
        JSON.stringify([beam.startPos, beam.startPos2, beam.endPos, beam.unit.x, beam.target.x]),
        native,
      );
    }
  }
});

test('undrawn objects use native coordinates and body contact follows source radius rule', () => {
  const beam = weapon(),
    view = new BeamRenderGeometry();
  beam.twin = false;
  beam.unit.isAddedToCanvas = false;
  view.update(beam);
  near(view.start.x, 110);
  near(view.start.y, 200);
  near(view.end.x, 200);
  beam.targetBody = { x: 210, y: 200, radius: 50, isAddedToCanvas: false, _mc: { x: 999, y: 999 } };
  view.update(beam);
  near(view.end.x, 180);
  near(view.end.y, 200);
  beam.targetBody.x = 120;
  view.update(beam);
  near(view.end.x, 116);
  beam.targetBody.x = 110;
  view.update(beam);
  near(view.end.x, 110);
});

test('authored phase mounts apply base scale, pivot and displayed mirroring exactly once', () => {
  const first = { x: 0, y: 0 },
    second = { x: 0, y: 0 },
    matrix: any = {};
  const clip: any = {
    parent: {},
    pivotX: 50,
    pivotY: 25,
    getTransformationMatrix(_space: any, out: any) {
      Object.assign(out, { a: -2, b: 0, c: 0, d: 2, tx: 300, ty: 100 });
    },
  };
  const count = writePhaseBladeMounts(
    { weaponPosX: 20, weaponPosY: 4 },
    { textureName: 'enemy_nexar_a', scale: 2 },
    clip,
    {},
    first,
    second,
    matrix,
  );
  assert.equal(count, 2);
  assert.deepEqual(first, { x: 180, y: 172 });
  assert.deepEqual(second, { x: 180, y: 136 });
  assert.equal(
    writePhaseBladeMounts(
      { weaponPosX: 20, weaponPosY: 4 },
      { textureName: 'player_crystal', scale: 2 },
      clip,
      {},
      first,
      second,
      matrix,
    ),
    1,
  );
  assert.deepEqual(first, second);
  assert.equal(writePhaseBladeMounts({}, { scale: 0 }, clip, {}, first, second, matrix), 0);
});

function nativeFixture() {
  function Base() {}
  const { Beam } = createBeamClasses(Base, Base, Base, {}, class {});
  const calls: any[] = [];
  let fail = false;
  Beam.prototype.drawBeamEffect = function (index: number, start: any, end: any, strands: number) {
    if (fail) throw Error('native draw failed');
    calls.push({
      index,
      start: { ...start },
      end: { ...end },
      strands,
      active: !!getActiveBeamGeometry(this),
    });
    return index + strands;
  };
  const game: any = {
    canvasEffects: {},
    get_me: () => ({ ship: { weaponHeat: { get_heat: () => 1, get_max: () => 1 } } }),
  };
  const api: any = {
    cls: (name: string) =>
      name === 'core.weapon.Beam' ? Beam : name === 'openfl.geom.Matrix' ? class {} : undefined,
    around(target: any, key: string, hook: Function) {
      const original = target[key];
      target[key] = function (...args: any[]) {
        return hook.call(this, original.bind(this), ...args);
      };
    },
  };
  installNativeBeamGeometry(api, game);
  const beam: any = Object.assign(Object.create(Beam.prototype), weapon(), {
    g: game,
    drawBeam: true,
    lines: [],
    lineBatch: { clear() {}, addMesh() {}, set_alpha() {} },
    beamAlpha: 1,
    beams: 2,
    lastPos: { x: 0, y: 0 },
    secondaryTargets: [],
  });
  return {
    beam,
    game,
    calls,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}

test('native Beam.draw receives rendered twins and ordered chain endpoints without mutating target state', () => {
  const f = nativeFixture();
  f.beam.target = { alive: true, _mc: { x: 300, y: 400 } };
  f.beam.secondaryTargets = [
    { alive: false },
    { alive: true, _mc: { x: 500, y: 600 }, get_pos: () => ({ x: 450, y: 550 }) },
    { alive: true, _mc: { x: 700, y: 800 }, get_pos: () => ({ x: 650, y: 750 }) },
  ];
  f.beam.draw();
  assert.equal(f.calls.length, 4);
  near(f.calls[0].start.x, 107);
  near(f.calls[1].start.x, 113);
  assert.deepEqual(f.calls[0].end, { x: 300, y: 400 });
  assert.deepEqual(f.calls[2].start, { x: 300, y: 400 });
  assert.deepEqual(f.calls[2].end, { x: 500, y: 600 });
  assert.deepEqual(f.calls[3].start, { x: 500, y: 600 });
  assert.deepEqual(f.calls[3].end, { x: 700, y: 800 });
  assert.equal(
    f.calls.every((call) => call.active),
    true,
  );
  assert.equal(getActiveBeamGeometry(f.beam), undefined);
  assert.deepEqual(f.beam.startPos, { x: 1, y: 2 });
  assert.deepEqual(f.beam.endPos, { x: 5, y: 6 });
  assert.equal(f.beam.secondaryTargets.length, 3);
});

test('native render failures release geometry context and other game instances are untouched', () => {
  const f = nativeFixture();
  f.fail(true);
  assert.throws(() => f.beam.draw(), /native draw failed/);
  assert.equal(getActiveBeamGeometry(f.beam), undefined);
  f.fail(false);
  f.beam.g = { ...f.game };
  f.beam.draw();
  assert.deepEqual(f.calls[0].start, { x: 1, y: 2 });
  assert.deepEqual(f.calls[0].end, { x: 5, y: 6 });
  assert.equal(f.calls[0].active, false);
});
