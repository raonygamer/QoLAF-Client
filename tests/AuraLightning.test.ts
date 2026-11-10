import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuraLightning } from '../src/rendering/AuraLightning';
import { Display } from './fixtures/NativeGame';

class Vertices {
  count = 0;
  points: number[][] = [];
  set_numVertices(count: number) {
    this.count = count;
  }
  get_numVertices() {
    return this.count;
  }
  setPoint(index: number, _key: string, x: number, y: number) {
    this.points[index] = [x, y];
  }
  colorize(_key: string, _color: number, _alpha: number, _start: number, _count: number) {}
}
class Indices {
  count = 0;
  set_numIndices(count: number) {
    this.count = count;
  }
  addQuad(..._indices: number[]) {
    this.count += 6;
  }
}
class Mesh extends Display {
  constructor(
    readonly vertices: Vertices,
    readonly indices: Indices,
  ) {
    super();
  }
  get_vertexData() {
    return this.vertices;
  }
  get_indexData() {
    return this.indices;
  }
  setVertexDataChanged() {}
  setIndexDataChanged() {}
}

test('source lightning uses bounded native geometry and endpoints from one opaque component', () => {
  const classes: any = {
    'starling.display.Mesh': Mesh,
    'starling.rendering.VertexData': Vertices,
    'starling.rendering.IndexData': Indices,
  };
  const Lightning = createAuraLightning({ cls: (name: string) => classes[name] } as any);
  const random = Math.random;
  let seed = 5;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let mesh: any;
  try {
    mesh = new Lightning();
    assert.equal(mesh.get_vertexData().count, 896);
    assert.equal(mesh.get_indexData().count, 1344);
    assert.equal(mesh.get_touchable(), false);
    const groups = [
      [
        { x: -0.8, y: 0 },
        { x: -0.4, y: 0.2 },
      ],
      [
        { x: 0.4, y: 0 },
        { x: 0.8, y: 0.2 },
      ],
    ];
    mesh.setAnchors(groups);
    let visible = 0;
    for (let frame = 0; frame < 1000; frame++) {
      mesh.advance(16, 40, 30, 0x4488ff, 8, 3, 0.25);
      if (mesh.get_visible()) visible++;
      for (let arc = 0; arc < mesh.arcs.length; arc++) {
        const state = mesh.arcs[arc];
        if (state.remainingMs <= 0) continue;
        assert.ok(
          groups.some(
            (group) => group.includes(state.startPoint) && group.includes(state.endPoint),
          ),
        );
        const points = mesh.get_vertexData().points;
        const start = arc * 14 * 8,
          end = start + 13 * 8;
        assert.ok(
          Math.abs((points[start][0] + points[start + 1][0]) / 2 - state.startPoint.x * 40) < 1e-8,
        );
        assert.ok(
          Math.abs((points[end + 2][1] + points[end + 3][1]) / 2 - state.endPoint.y * 30) < 1e-8,
        );
      }
    }
    assert.ok(visible > 0);
    mesh.setAnchors([]);
    mesh.advance(16, 40, 30, 0xffffff);
    assert.equal(mesh.get_visible(), false);
    mesh.dispose();
    mesh.dispose();
    assert.equal(mesh.disposed, true);
  } finally {
    Math.random = random;
    mesh?.dispose();
  }
});
