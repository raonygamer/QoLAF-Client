import { ClientDevVisual } from '../src/visuals/ClientDevVisual';
import { bindGameClasses, type Beam } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BeamRenderGeometry,
  getActiveBeamGeometry,
  renderPosition,
} from '../src/weapon/BeamRenderGeometry';
import { installNativeBeamGeometry } from '../src/weapon/NativeBeamGeometry';
import { writePhaseBladeMounts } from '../src/weapon/PhaseBladeMounts';
// @ts-expect-error official native beam fixture
import createBeamClasses from './fixtures/UpstreamBeam.js';

function pose<
  T extends {
    x?: number;
    y?: number;
    rotation?: number;
    radius?: number;
    _mc?: { x: number; y: number; rotation?: number };
    isAddedToCanvas?: boolean;
  },
>(value: T) {
  return Object.assign(value, {
    isAddedToCanvas: value.isAddedToCanvas ?? true,
    get_x() {
      return value.x ?? 0;
    },
    get_y() {
      return value.y ?? 0;
    },
    get_rotation() {
      return value.rotation ?? 0;
    },
    get_radius() {
      return value.radius ?? 0;
    },
    get_movieClip() {
      const clip = value._mc;
      return clip
        ? {
            get_x: () => clip.x,
            get_y: () => clip.y,
            get_rotation: () => clip.rotation ?? 0,
          }
        : null;
    },
  });
}

function weapon() {
  const fixture = {
    unit: pose({
      isAddedToCanvas: true as boolean,
      weaponPos: { x: 10, y: 0 },
      x: 100,
      y: 200,
      rotation: 0,
      _mc: { x: 110, y: 210, rotation: Math.PI / 2 },
    }),
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
  return fixture as typeof fixture & Beam;
}
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('beam muzzle and endpoints advance with rendered poses without simulation updates at 60/120/180 FPS', () => {
  for (const fps of [60, 120, 180]) {
    const beam = weapon(),
      view = new BeamRenderGeometry();
    beam.target = pose({ alive: true, x: 500, y: 600, _mc: { x: 510, y: 610 } });
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
  beam.targetBody = pose({
    x: 210,
    y: 200,
    radius: 50,
    isAddedToCanvas: false,
    _mc: { x: 999, y: 999 },
  });
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

function nativeFixture(drawCopies = false) {
  class PlayerShip {}
  function Base() {}
  const { Beam } = createBeamClasses(Base, Base, Base, {}, class {});
  Beam.prototype.get_name = function () {
    return this.name ?? 'Other';
  };
  Beam.prototype.get_fire = function () {
    return this._fire;
  };
  Beam.prototype.set_fire = function (value: boolean) {
    this._fire = value;
    return value;
  };
  Beam.prototype.destroy = function () {
    this.alive = false;
  };
  if (drawCopies) {
    Beam.prototype.draw = function () {
      this.drawBeamEffect(0, this.drawStartPos, this.endPos, 1);
      this.drawBeamEffect(1, this.drawStartPos2, this.endPos, 1);
      this.drawBeamEffect(2, this.lastPos, this.secondaryTargets[0].get_pos(), 1);
    };
  }
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
    time: 1000,
    canvasEffects: {},
    get_me: () => ({ ship: { weaponHeat: { get_heat: () => 1, get_max: () => 1 } } }),
  };
  const cleanups: Array<() => void> = [];
  const api: any = {
    cls: (name: string) =>
      name === 'core.weapon.Beam'
        ? Beam
        : name === 'core.ship.PlayerShip'
          ? PlayerShip
          : name === 'openfl.geom.Matrix'
            ? class {}
            : undefined,
    defer(off: () => void) {
      cleanups.push(off);
    },
    before(target: any, key: string, hook: Function) {
      this.around(target, key, function (this: any, next: Function, ...args: any[]) {
        hook.apply(this, args);
        return next(...args);
      });
    },
    around(target: any, key: string, hook: Function) {
      const original = target[key];
      target[key] = function (...args: any[]) {
        return hook.call(this, original.bind(this), ...args);
      };
      const off = () => {
        target[key] = original;
      };
      cleanups.push(off);
      return off;
    },
  };
  bindGameClasses({ ...api, cls: (name: string) => api.cls(name) ?? class {} });
  installNativeBeamGeometry(api, game);
  const beam: any = Object.assign(Object.create(Beam.prototype), weapon(), {
    g: game,
    alive: true,
    _fire: true,
    name: 'Other',
    drawStartPos: { x: -1, y: -2 },
    drawStartPos2: { x: -3, y: -4 },
    startBeamAlpha: 1,
    drawBeam: true,
    lines: [],
    lineBatch: { clear() {}, addMesh() {}, set_alpha() {} },
    beamAlpha: 1,
    beams: 2,
    lastPos: { x: 0, y: 0 },
    secondaryTargets: [],
  });
  return {
    PlayerShip,
    beam,
    game,
    calls,
    close: () => cleanups.reverse().forEach((off) => off()),
    fail: (value: boolean) => {
      fail = value;
    },
  };
}

test('native Beam.draw receives rendered twins and ordered chain endpoints without mutating target state', () => {
  const f = nativeFixture();
  f.beam.target = pose({ alive: true, _mc: { x: 300, y: 400 } });
  f.beam.secondaryTargets = [
    { alive: false },
    pose({ alive: true, _mc: { x: 500, y: 600 }, get_pos: () => ({ x: 450, y: 550 }) }),
    pose({ alive: true, _mc: { x: 700, y: 800 }, get_pos: () => ({ x: 650, y: 750 }) }),
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

test('Skeletor retains visual connections without writing native targets or endpoints', () => {
  const f = nativeFixture();
  f.beam.name = 'Skeletor Lightning';
  f.beam.angleVariance = 0.2;
  f.beam.unit.get_renderRotation = () => Math.PI / 2;
  const primary = pose({ alive: true, collisionRadius: 5, _mc: { x: 110, y: 260 } });
  const chain = pose({
    alive: true,
    collisionRadius: 5,
    _mc: { x: 110, y: 280 },
    get_pos: () => ({ x: 100, y: 270 }),
  });
  f.beam.target = primary;
  f.beam.secondaryTargets = [chain];
  const points = JSON.stringify([f.beam.startPos, f.beam.endPos, f.beam.lastPos]);
  f.beam.draw();
  assert.equal(f.calls.length, 3);
  f.calls.length = 0;
  f.beam.target = null;
  const nativeTargets: object[] = [];
  f.beam.secondaryTargets = nativeTargets;
  f.game.time = 1001;
  f.beam.draw();
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.calls[0].end, { x: 110, y: 260 });
  assert.deepEqual(f.calls[2].end, { x: 110, y: 280 });
  f.game.time = 1167;
  f.calls.length = 0;
  f.beam.draw();
  assert.equal(f.calls.length, 2, 'secondary grace expires independently');
  assert.deepEqual(f.calls[0].end, { x: 110, y: 260 }, 'firing within hysteresis retains primary');
  assert.equal(f.beam.target, null);
  assert.equal(f.beam.secondaryTargets, nativeTargets);
  assert.equal(JSON.stringify([f.beam.startPos, f.beam.endPos, f.beam.lastPos]), points);
});

test('Skeletor fire stop holds until deadline, resumes without replaying emitters, then clears', () => {
  const f = nativeFixture();
  f.beam.name = 'Skeletor Lightning';
  f.beam.angleVariance = 0.2;
  f.beam.unit.get_renderRotation = () => Math.PI / 2;
  f.beam.target = pose({ alive: true, collisionRadius: 5, _mc: { x: 110, y: 260 } });
  let plays = 0,
    stops = 0,
    detached = 0;
  const emitter = {
    isEmitting: true,
    play() {
      plays++;
    },
    stop() {
      stops++;
    },
  };
  f.beam.startEffect = [emitter];
  f.beam.startEffect2 = [emitter];
  f.beam.endEffect = [emitter];
  f.beam.lineBatch.removeFromParent = () => detached++;
  f.beam.draw();
  f.beam.set_fire(false);
  assert.equal(f.beam._fire, false);
  assert.equal(f.beam.drawBeam, true);
  assert.equal(stops, 0);
  f.game.time = 1100;
  f.beam.set_fire(true);
  assert.equal(plays, 0);
  f.beam.set_fire(false);
  f.game.time = 1264;
  f.calls.length = 0;
  f.beam.draw();
  assert.equal(f.calls.length, 2);
  f.game.time = 1265;
  f.calls.length = 0;
  f.beam.draw();
  assert.equal(f.calls.length, 0);
  assert.equal(f.beam.drawBeam, false);
  assert.equal(stops, 3);
  assert.equal(detached, 1);
  f.beam.drawBeam = true;
  f.beam.set_fire(true);
  f.beam.set_fire(false);
  f.close();
  assert.equal(f.beam.drawBeam, false, 'unload clears a pending visual hold');
  assert.equal(detached, 2);
  f.beam.set_fire(true);
  assert.equal(f.beam._fire, true, 'native setter restored');
});

test('bound player ship mounts drive phase blades through both custom and native clip paths', () => {
  const f = nativeFixture();
  try {
    const ship = Object.assign(new f.PlayerShip(), f.beam.unit, {
      writePhaseBladeMounts(first: { x: number; y: number }, second: { x: number; y: number }) {
        Object.assign(first, { x: 20, y: 30 });
        Object.assign(second, { x: 40, y: 50 });
        return 2;
      },
    });
    f.beam.unit = ship;
    f.beam.key = ClientDevVisual.PHASE_BLADE;
    f.beam.twin = false;
    f.beam.draw();
    assert.deepEqual(
      f.calls.map((call) => call.start),
      [
        { x: 20, y: 30 },
        { x: 40, y: 50 },
      ],
    );
    delete ship.writePhaseBladeMounts;
    ship.obj = { weaponPosX: 10, weaponPosY: 4 };
    ship.imgObj = { scale: 1, textureName: 'player_crystal' };
    let clipReads = 0;
    ship.get_movieClip = () => {
      clipReads++;
      return {
        get_x: () => 110,
        get_y: () => 210,
        get_rotation: () => Math.PI / 2,
        get_parent: () => f.game.canvasEffects,
        get_pivotX: () => 0,
        get_pivotY: () => 0,
        getTransformationMatrix(_space: object, matrix: object) {
          Object.assign(matrix, { a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 200 });
        },
      };
    };
    f.calls.length = 0;
    f.beam.draw();
    assert.ok(clipReads > 0);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].start, { x: 110, y: 204 });
  } finally {
    f.close();
  }
});

test('pooled clips stay ignored until rendered and installed accessors bypass clip reads', () => {
  const beam = weapon();
  const point = { x: 0, y: 0 };
  const owner = Object.assign(beam.unit, { hasRenderPosition: false });
  renderPosition(owner, point);
  assert.deepEqual(point, { x: 100, y: 200 });
  owner.hasRenderPosition = true;
  renderPosition(owner, point);
  assert.deepEqual(point, { x: 110, y: 210 });
  const accessorOwner = Object.assign(owner, {
    get_renderX: () => 120,
    get_renderY: () => 230,
    get_movieClip() {
      throw Error('render accessors must own pose resolution');
    },
  });
  renderPosition(accessorOwner, point);
  assert.deepEqual(point, { x: 120, y: 230 });
});

test('current native draw copies preserve rotated muzzles and the first chain target', () => {
  const f = nativeFixture(true);
  try {
    f.beam.target = pose({ alive: true, _mc: { x: 300, y: 400 } });
    f.beam.secondaryTargets = [
      pose({ alive: true, _mc: { x: 500, y: 600 }, get_pos: () => ({ x: 1, y: 2 }) }),
    ];
    f.beam.draw();
    near(f.calls[0].start.x, 107);
    near(f.calls[1].start.x, 113);
    assert.deepEqual(f.calls[2].start, { x: 300, y: 400 });
    assert.deepEqual(f.calls[2].end, { x: 500, y: 600 });
  } finally {
    f.close();
  }
});
