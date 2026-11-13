import { installBeamEmitterTint } from '../src/visuals/BeamEmitterTint';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativePhaseBlade, type HullPalette } from '../src/visuals/NativePhaseBlade';
import { ClientDevVisual } from '../src/visuals/ClientDevVisual';
// @ts-expect-error official Haxe geometry fixture
import createBeamClasses from './fixtures/UpstreamBeam.js';

class Matrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  tx = 0;
  ty = 0;
  setTo(a: number, b: number, c: number, d: number, tx: number, ty: number) {
    Object.assign(this, { a, b, c, d, tx, ty });
  }
  copyFrom(value: Matrix) {
    Object.assign(this, value);
  }
  concat(m: Matrix) {
    const { a, b, c, d, tx, ty } = this;
    this.setTo(
      m.a * a + m.c * b,
      m.b * a + m.d * b,
      m.a * c + m.c * d,
      m.b * c + m.d * d,
      m.a * tx + m.c * ty + m.tx,
      m.b * tx + m.d * ty + m.ty,
    );
  }
}
class Style {
  static VERTEX_FORMAT = { extend: () => ({}) };
  texture: any;
  target: any;
  get_vertexData() {
    return this.target.vertices;
  }
  setVertexDataChanged() {}
  set_texture(value: any) {
    this.texture = value;
  }
  set_textureSmoothing() {}
  textureRepeat = false;
  set_textureRepeat(value: boolean) {
    this.textureRepeat = value;
  }
}
class Filter {
  disposed = false;
  get_padding() {
    return { copyFrom() {} };
  }
  dispose() {
    this.disposed = true;
  }
  setColorAt() {}
  setAlphaAt() {}
}
function Display(this: any, texture: any = { get_width: () => 1, get_height: () => 1 }) {
  Object.assign(this, {
    x: 0,
    y: 0,
    rotation: 0,
    width: 1,
    height: 1,
    color: 0x123456,
    alpha: 1,
    visible: true,
    blendMode: 'add',
    filter: null,
    texture,
    records: [],
  });
  this.style = new Style();
  this.style.target = this;
  this.vertices = {
    points: [] as number[][],
    get_numVertices: () => 4,
    getPoint: (i: number, _name: string, point: any) =>
      Object.assign(point, { x: i % 2, y: Math.floor(i / 2) }),
    setPoint: (i: number, _name: string, x: number, y: number) => {
      this.vertices.points[i] = [x, y];
    },
  };
}
for (const field of [
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'color',
  'alpha',
  'visible',
  'blendMode',
  'filter',
  'texture',
]) {
  (Display.prototype as any)['get_' + field] = function () {
    return this[field];
  };
  (Display.prototype as any)['set_' + field] = function (value: any) {
    this[field] = value;
    return value;
  };
}
Object.assign(Display.prototype, {
  set_touchable() {},
  set_pivotY() {},
  readjustSize() {},
  get_style(this: any): any {
    return this.style;
  },
  setStyle(this: any, style: any) {
    this.style = style;
    style.target = this;
  },
  get_textureSmoothing() {
    return 'bilinear';
  },
  get_transformationMatrix(this: any) {
    const m = new Matrix(),
      c = Math.cos(this.rotation),
      s = Math.sin(this.rotation);
    m.setTo(c * this.width, s * this.width, -s * this.height, c * this.height, this.x, this.y);
    return m;
  },
  clear(this: any) {
    this.records = [];
  },
  addMesh(this: any, mesh: any) {
    this.records.push({
      width: mesh.width,
      alpha: mesh.alpha,
      color: mesh.color,
      points: mesh.vertices.points.map((v: number[]) => [...v]),
      style: mesh.style,
      records: mesh.records?.slice(),
    });
  },
});

function fixture() {
  const { Line, BeamLine, Beam } = createBeamClasses(
    Display,
    Display,
    Display,
    {
      getService: () => ({
        getTextureMainByTextureName: () => ({ get_width: () => 1, get_height: () => 1 }),
      }),
    },
    class {
      x = 0;
      y = 0;
    },
  );
  const cleanups: (() => void)[] = [];
  const game: any = {
    get_me: () => ({ ship: { weaponHeat: { get_heat: () => 1, get_max: () => 1 } } }),
  };
  class Collective {
    static meshBatches: Collective[] = [];
    emitters: any[] = [];
    blendMode = 'add';
    clears = 0;
    disposed = false;
    set_blendMode(value: string) {
      this.blendMode = value;
    }
    get_blendMode() {
      return this.blendMode;
    }
    remove(emitter: any) {
      this.emitters = this.emitters.filter((value) => value !== emitter);
    }
    markUpdated() {}
    clear() {
      this.clears++;
    }
    removeFromParent() {}
    dispose() {
      this.disposed = true;
    }
  }
  class Emitter {
    collectiveMeshBatch: Collective | null = new Collective();
    constructor() {
      this.collectiveMeshBatch!.emitters.push(this);
    }
    setBatchParent() {}
    particles: any[] = [];
    inactiveParticles: any[] = [];
    _startColor = 0x808080;
    _finishColor = 0x202020;
    _originalStartColor = 0x808080;
    _originalFinishColor = 0x202020;
    add() {
      const particle = new (Display as any)();
      this.particles.push(particle);
      return particle;
    }
    dispose() {
      this.collectiveMeshBatch = null;
    }
  }
  const defs: any = {
    'core.particle.Emitter': Emitter,
    'core.particle.CollectiveMeshBatch': Collective,
    'core.weapon.Beam': Beam,
    'core.hud.components.BeamLine': BeamLine,
    'core.hud.components.Line': Line,
    'openfl.geom.Matrix': Matrix,
    'starling.styles.MeshStyle': Style,
    'starling.rendering.MeshEffect': class {},
    'starling.rendering.FilterEffect': {},
    'starling.rendering.Program': {},
    'openfl._Vector.FloatVector': class {},
    'openfl.geom.Point': class {
      x = 0;
      y = 0;
    },
    'core.scene.Game': {},
    'starling.filters.FragmentFilter': Filter,
    'starling.filters.BlurFilter': Filter,
    'starling.filters.CompositeFilter': Filter,
  };
  const api: any = {
    cls: (name: string) => defs[name],
    defer: (fn: () => void) => cleanups.push(fn),
    around(target: any, key: string, hook: Function) {
      const old = target[key];
      target[key] = function (...args: any[]) {
        return hook.call(this, old.bind(this), ...args);
      };
      cleanups.push(() => {
        target[key] = old;
      });
    },
    before(target: any, key: string, hook: Function) {
      this.around(target, key, function (this: any, next: Function, ...args: any[]) {
        hook.apply(this, args);
        return next(...args);
      });
    },
  };
  const pool: any[] = [];
  game.linePool = {
    getLine: () => {
      const line = new Line();
      pool.push(line);
      return line;
    },
    removeLine() {},
  };
  const line = new BeamLine(game);
  line.init(2, 2, 0, 0x123456, 1, 3, 0, 'line2');
  const batch: any = new (Display as any)();
  const weapon: any = Object.assign(Object.create(Beam.prototype), {
    g: game,
    key: ClientDevVisual.PHASE_BLADE,
    drawBeam: true,
    beams: 1,
    lines: [line],
    lineBatch: batch,
    beamAlpha: 0.6,
    twin: false,
    chargeUpMax: 0,
    beamThickness: 2,
    startPos: { x: 10, y: 20 },
    endPos: { x: 110, y: 20 },
    lastPos: { x: 0, y: 0 },
    secondaryTargets: [],
    unit: {
      movieClip: {
        rotation: 0,
        texture: { width: 100, height: 100 },
        scaleX: 1,
        scaleY: 1,
        pivotX: 0,
        pivotY: 0,
        x: 10,
        y: 20,
      },
    },
  });
  let palette: HullPalette | null = { mode: 1, settings: ClientDevVisual.defaults() };
  installNativePhaseBlade(
    api,
    game,
    (name) => defs[name],
    () => palette,
  );
  return {
    api,
    resolve: (name: string) => defs[name],
    game,
    Emitter,
    Collective,
    weapon,
    line,
    batch,
    pool,
    setPalette: (value: HullPalette | null) => {
      palette = value;
    },
    cleanup: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('native blade batches continuous hull coordinates, retains inner overlap and stops at tip', () => {
  const f = fixture();
  f.weapon.draw();
  assert.equal(f.batch.blendMode, 'normal');
  assert.ok(f.batch.filter instanceof Filter);
  assert.equal(f.line.records.length, 2);
  assert.equal(
    f.line.records[0].width,
    54,
    '50-unit interior segment overlaps by its 4-unit thickness',
  );
  assert.equal(f.line.records[1].width, 50, 'last segment ends at the native endpoint');
  assert.equal(f.line.records[0].color, 0xffffff);
  assert.equal(f.line.records[1].points[0][0], 0.5);
  assert.equal(f.line.records[1].points[1][0], 1);
  for (const segment of f.pool) {
    assert.equal(segment.style.constructor, Style, 'pool must retain the original style');
    assert.equal(segment.color, 0x123456);
    assert.equal(segment.overlap, true);
  }
  assert.deepEqual(f.weapon.endPos, { x: 110, y: 20 }, 'native targeting endpoint is not changed');
  const bloom = f.batch.filter;
  f.cleanup();
  assert.equal(f.batch.blendMode, 'add');
  assert.equal(f.batch.filter, null);
  assert.equal(bloom.disposed, true);
});

test('other weapons retain native geometry and disabled palettes restore native segment colors', () => {
  const f = fixture();
  f.weapon.key = 'another-weapon';
  f.weapon.draw();
  assert.equal(f.batch.blendMode, 'add');
  assert.equal(f.batch.filter, null);
  assert.equal(f.line.records[1].color, 0x123456);
  assert.ok(f.line.records[1].width > 50);
  f.weapon.key = ClientDevVisual.PHASE_BLADE;
  f.setPalette(null);
  f.weapon.draw();
  assert.equal(f.line.records[1].width, 50);
  assert.equal(f.line.records[1].color, 0x123456);
  f.cleanup();
});

test('batch failures restore pooled styles and context, and unrelated filters are preserved', () => {
  const f = fixture();
  const foreign = new Filter();
  f.batch.filter = foreign;
  const addMesh = (Display.prototype as any).addMesh;
  // The hook calls the captured native implementation, whose body delegates here.
  f.line.records.push = () => {
    throw Error('batch failure');
  };
  // Native lineTo clears records, so make that clear retain the throwing buffer.
  f.line.clear = () => {};
  const originalClear = (Display.prototype as any).clear;
  (Display.prototype as any).clear = function () {
    originalClear.call(this);
    if (this === f.line)
      this.records.push = () => {
        throw Error('batch failure');
      };
  };
  try {
    assert.throws(() => f.weapon.draw(), /batch failure/);
    assert.equal(f.batch.filter, foreign);
    for (const segment of f.pool) assert.equal(segment.style.constructor, Style);
    (Display.prototype as any).clear = originalClear;
    f.weapon.key = 'another-weapon';
    f.weapon.draw();
    assert.equal(f.line.records[1].color, 0x123456);
  } finally {
    (Display.prototype as any).clear = originalClear;
    (Display.prototype as any).addMesh = addMesh;
    f.cleanup();
  }
  assert.equal(foreign.disposed, false);
});

test('blade emitter tints preserve brightness, style newly emitted particles and restore pooled state', () => {
  const f = fixture();
  const emitter = new f.Emitter();
  const previousBatch = emitter.collectiveMeshBatch!;
  const particle = emitter.add();
  const original = particle.get_style();
  f.weapon.startEffect = [emitter];
  const settings = ClientDevVisual.defaults();
  settings.palette = 'solid';
  settings.colorA = 0xff8040;
  f.setPalette({ mode: 1, settings });
  f.weapon.draw();
  assert.ok(previousBatch.clears > 0, 'empty original batch must not retain the previous frame');
  assert.equal(emitter._startColor, 0x804020);
  assert.equal(emitter._finishColor, 0x201008);
  assert.notEqual(particle.get_style(), original);
  const next = emitter.add();
  assert.equal(next.get_style().__class__.__name__, 'qolaf.visuals.GrayscaleTintStyle');
  f.setPalette(null);
  f.weapon.draw();
  assert.equal(particle.get_style(), original);
  assert.equal(next.get_style().constructor, Style);
  assert.equal(emitter._startColor, 0x808080);
  assert.equal(emitter._finishColor, 0x202020);
  f.setPalette({ mode: 1, settings });
  f.weapon.draw();
  emitter.dispose();
  assert.equal(particle.get_style(), original);
  f.cleanup();
});

test('grayscale emitter batches stay isolated from ordinary effects and disposal cannot leak membership', () => {
  const f = fixture();
  const emitter = new f.Emitter();
  const previous = emitter.collectiveMeshBatch!;
  const other = new f.Emitter();
  other.collectiveMeshBatch = previous;
  previous.emitters.push(other);
  const otherParticle = other.add();
  const otherStyle = otherParticle.get_style();
  f.weapon.startEffect = [emitter];
  f.weapon.draw();
  const isolated = emitter.collectiveMeshBatch!;
  assert.notEqual(isolated, previous);
  assert.deepEqual(previous.emitters, [other]);
  assert.deepEqual(isolated.emitters, [emitter]);
  assert.equal(otherParticle.get_style(), otherStyle);
  assert.equal(other._startColor, 0x808080);
  f.setPalette(null);
  f.weapon.draw();
  assert.equal(emitter.collectiveMeshBatch, previous);
  assert.ok(previous.emitters.includes(emitter));
  assert.equal(isolated.emitters.length, 0);
  f.setPalette({ mode: 1, settings: ClientDevVisual.defaults() });
  f.weapon.draw();
  emitter.collectiveMeshBatch!.remove(emitter); // Native manager removes before disposing.
  emitter.dispose();
  assert.equal(previous.emitters.includes(emitter), false);
  assert.equal(isolated.emitters.includes(emitter), false);
  f.cleanup();
  assert.equal(isolated.disposed, true);
  assert.equal(f.Collective.meshBatches.length, 0);
});

test('turning weapon grayscale off returns emitters to their compatible original batch', () => {
  const f = fixture();
  const tint = installBeamEmitterTint(f.api, f.resolve);
  const emitter = new f.Emitter();
  const originalBatch = emitter.collectiveMeshBatch;
  const particle = emitter.add();
  const originalStyle = particle.get_style();
  const owner = {};
  tint.updateFixed(owner, [emitter], 0xff0000, true);
  const grayscaleBatch = emitter.collectiveMeshBatch!;
  assert.notEqual(grayscaleBatch, originalBatch);
  tint.updateFixed(owner, [emitter], 0x00ff00, false);
  assert.equal(emitter.collectiveMeshBatch, originalBatch);
  assert.equal(grayscaleBatch.emitters.length, 0);
  assert.equal(particle.get_style(), originalStyle);
  assert.equal(emitter._startColor, 0x008000);
  assert.equal(emitter.add().get_style().constructor, Style);
  tint.release(owner);
  assert.equal(emitter._startColor, 0x808080);
  f.cleanup();
});

test('fixed colors and hull palettes transfer emitter ownership without nesting temporary batches', () => {
  const f = fixture();
  const tint = installBeamEmitterTint(f.api, f.resolve);
  const emitter = new f.Emitter();
  const originalBatch = emitter.collectiveMeshBatch!;
  const particle = emitter.add();
  const originalStyle = particle.get_style();
  f.weapon.startEffect = [emitter];
  f.weapon.draw();
  const hullBatch = emitter.collectiveMeshBatch!;
  assert.notEqual(hullBatch, originalBatch);

  // This is the actual hook order when disabling the hull palette: fixed RGB
  // takes ownership before the nested hull hook sees its now-empty palette.
  f.setPalette(null);
  tint.updateFixed(f.weapon, [emitter], 0xff0000, true);
  const fixedBatch = emitter.collectiveMeshBatch!;
  f.weapon.draw();
  assert.notEqual(fixedBatch, hullBatch);
  assert.equal(emitter.collectiveMeshBatch, fixedBatch);
  assert.equal(hullBatch.emitters.length, 0);
  assert.equal(emitter._startColor, 0x800000);
  tint.release(f.weapon);
  assert.equal(emitter.collectiveMeshBatch, originalBatch);
  assert.equal(particle.get_style(), originalStyle);
  assert.equal(emitter._startColor, 0x808080);

  tint.updateFixed(f.weapon, [emitter], 0x00ff00, true);
  f.setPalette({ mode: 1, settings: ClientDevVisual.defaults() });
  f.weapon.draw();
  tint.release(f.weapon); // A stale owner's cleanup cannot undo the hull palette.
  assert.equal(emitter.collectiveMeshBatch, hullBatch);
  assert.equal(fixedBatch.emitters.length, 0);
  f.setPalette(null);
  f.weapon.draw();
  assert.equal(emitter.collectiveMeshBatch, originalBatch);
  assert.equal(particle.get_style(), originalStyle);
  assert.equal(originalBatch.emitters.filter((value) => value === emitter).length, 1);
  f.cleanup();
});
