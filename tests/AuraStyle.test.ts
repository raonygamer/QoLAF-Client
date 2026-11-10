import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuraStyle } from '../src/rendering/AuraStyle';
import { auraShader } from '../src/rendering/AuraShader';
import type { Raw } from '../src/api/Types';

function fixture(rotated: boolean) {
  const buffers: any[] = [];
  const format = { setVertexBufferAt: (...args: any[]) => buffers.push(args) };
  class MeshStyle {
    static VERTEX_FORMAT = { extend: () => format };
    texture: any;
    vertices: any;
    get_texture() {
      return this.texture;
    }
    get_vertexData() {
      return this.vertices;
    }
    setVertexDataChanged() {}
  }
  class MeshEffect {
    texture: any;
    get_texture() {
      return this.texture;
    }
    get_programVariantName() {
      return 2;
    }
    get_vertexBuffer() {
      return 'buffer';
    }
    beforeDraw(_context: any) {}
    afterDraw(_context: any) {}
  }
  class FloatVector {
    constructor(
      _length: number,
      _fixed: boolean,
      public values: number[],
    ) {}
    set(index: number, value: number) {
      this.values[index] = value;
    }
  }
  const settings = { disableRemasteredAuras: false };
  const starling = { profile: 'standard' };
  const classes: Raw = {
    'starling.styles.MeshStyle': MeshStyle,
    'starling.rendering.MeshEffect': MeshEffect,
    'starling.rendering.FilterEffect': {
      tex: (dest: string, coord: string) => `tex ${dest}, ${coord}, fs0 <2d,linear,clamp>\n`,
    },
    'starling.rendering.Program': {
      fromSource: (vertex: string, fragment: string) => ({ vertex, fragment }),
    },
    'starling.core.Starling': { get_current: () => starling },
    'openfl._Vector.FloatVector': FloatVector,
    'openfl.geom.Point': class {
      x = 0;
      y = 0;
    },
    'core.particle.Particle': class {},
    'core.scene.SceneBase': { clientSettings: settings },
  };
  const Style = createAuraStyle({
    cls: (key: string) => classes[key],
    game: {
      clock: { getServerTime: () => 800 },
      getServerTime: () => assert.fail('drawing an aura must not update simulation time'),
    },
  } as any);
  const style = new Style();
  const points: any[] = Array.from({ length: 4 }, () => ({}));
  const vertices = {
    get_numVertices: () => 4,
    getPoint: (index: number, key: string, result: Raw) =>
      Object.assign(result, points[index][key]),
    setPoint: (index: number, key: string, x: number, y: number) => {
      points[index][key] = { x, y };
    },
    setPoint4D: (index: number, key: string, ...values: number[]) => {
      points[index][key] = values;
    },
  };
  const uv = (u: number, v: number) =>
    rotated ? { x: 0.5 - v * 0.1, y: 0.25 + u * 0.2 } : { x: 0.25 + u * 0.2, y: 0.5 + v * 0.1 };
  const texture = {
    get_root: () => ({ get_nativeWidth: () => 100, get_nativeHeight: () => 100 }),
    get_width: () => 20,
    get_height: () => 10,
    setupVertexPositions() {
      points.forEach((p, i) => {
        p.position = { x: (i & 1) * 20, y: i < 2 ? 0 : 10 };
      });
    },
    setupTextureCoordinates() {
      points.forEach((p, i) => {
        p.texCoords = uv(i & 1, i < 2 ? 0 : 1);
      });
    },
    setTexCoords(_data: Raw, index: number, _key: string, u: number, v: number) {
      points[index].texCoords = uv(u, v);
    },
  };
  style.texture = texture;
  style.vertices = vertices;
  return { style, texture, points, settings, starling, buffers };
}

test('aura geometry pads two texels without accumulation and keeps rotated atlas bounds per vertex', () => {
  for (const rotated of [false, true]) {
    const { style, points } = fixture(rotated);
    style.prepareQuad();
    const first = structuredClone(points);
    style.prepareQuad();
    assert.deepEqual(points, first);
    assert.ok(Math.abs(points[0].position.x + 2) < 1e-10);
    assert.ok(Math.abs(points[0].position.y + 2) < 1e-10);
    assert.ok(Math.abs(points[3].position.x - 22) < 1e-10);
    assert.ok(Math.abs(points[3].position.y - 12) < 1e-10);
    const bounds = points[0].auraBounds;
    points.forEach((p) => assert.deepEqual(p.auraBounds, bounds));
    const expected = rotated ? [0.405, 0.255, 0.495, 0.445] : [0.255, 0.505, 0.445, 0.595];
    bounds.forEach((v: number, i: number) => assert.ok(Math.abs(v - expected[i]) < 1e-10));
  }
});

test('aura effect selects source variants and uploads native vectors and synchronized flow', () => {
  const { style, texture, settings, starling, buffers } = fixture(false);
  const effect = style.createEffect();
  effect.texture = texture;
  assert.equal(effect.get_programVariantName(), 2);
  assert.match(effect.createProgram().fragment, /sin ft7.x/);
  settings.disableRemasteredAuras = true;
  assert.equal(effect.get_programVariantName(), 18);
  assert.doesNotMatch(effect.createProgram().fragment, /sin ft7.x/);
  starling.profile = 'baselineConstrained';
  assert.equal(effect.get_programVariantName(), 50);
  assert.equal((effect.createProgram().fragment.match(/tex /g) ?? []).length, 1);
  const constants: number[][] = [];
  const context = {
    setProgramConstantsFromVector(type: number, index: number, vector: Raw, count: number) {
      assert.equal(type, 0);
      assert.equal(count, 1);
      constants[index] = [...vector.values];
    },
    setVertexBufferAt(index: number, buffer: Raw | null) {
      assert.equal(index, 3);
      assert.equal(buffer, null);
    },
  };
  effect.beforeDraw(context);
  assert.deepEqual(constants[0], [0.299, 0.587, 0.114, 0]);
  assert.deepEqual(constants[1], [100, 100, 0.01, 0.01]);
  assert.deepEqual(constants[4], [100 / 48, 100 / 80, 0.25, Math.PI * 2]);
  assert.deepEqual(buffers, [[3, 'buffer', 'auraBounds']]);
  effect.afterDraw(context);
});

test('source shaders retain bounded samples in all three modes', () => {
  for (const [mode, reads] of [
    ['remastered', 4],
    ['vanilla', 5],
    ['constrained', 1],
  ] as const) {
    const { vertex, fragment } = auraShader(
      mode,
      (dest, coords) => `tex ${dest}, ${coords}, fs0 <2d,linear,clamp>\n`,
    );
    assert.match(vertex, /mov v2, va3/);
    assert.equal((fragment.match(/tex /g) ?? []).length, reads);
    assert.equal((fragment.match(/min .*v2.zw/g) ?? []).length, reads);
    assert.match(fragment, /dp3 ft1.x/);
  }
});
