import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuraOutlineLightning } from '../src/rendering/AuraOutlineLightning';
import { Mesh, Vertices, Indices } from './fixtures/AuraMesh';

test('outline lightning wraps one contour, preserves burst duration and updates on every rendered frame', () => {
  const classes: any = {
    'starling.display.Mesh': Mesh,
    'starling.rendering.VertexData': Vertices,
    'starling.rendering.IndexData': Indices,
  };
  const Outline = createAuraOutlineLightning({ cls: (name: string) => classes[name] } as any);
  const random = Math.random;
  Math.random = () => 0.5;
  let mesh: any;
  try {
    mesh = new Outline();
    mesh.setContours([
      [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ],
    ]);
    const path = mesh.paths[0];
    const point = { x: 0, y: 0 };
    mesh.sampleContour(path, -0.125, point);
    assert.deepEqual(point, { x: -1, y: 0 });
    mesh.sampleContour(path, 1.125, point);
    assert.deepEqual(point, { x: 0, y: -1 });
    let first = -1;
    for (let frame = 0; frame < 5000; frame++) {
      mesh.advance(10, 40, 30, 0x4488ff, 8, 3, 0.25 / 16);
      if (mesh.arcs[0].remainingMs > 0) {
        first = frame;
        break;
      }
    }
    assert.ok(first > 3000, 'outline quiet gap uses the source /16 multiplier');
    assert.equal(mesh.arcs[0].remainingMs, 720);
    assert.equal(mesh.get_vertexData().count, 896);
    const positions = structuredClone(mesh.get_vertexData().points);
    mesh.advance(5.5, 40, 30, 0x4488ff, 8, 3, 0.25 / 16);
    assert.equal(mesh.arcs[0].remainingMs, 714.5);
    assert.notDeepEqual(mesh.get_vertexData().points, positions);
    assert.equal(mesh.get_visible(), true);
    assert.equal(mesh.arcs[0].waitMs, 2700 + 720 * 15 * ((3 * 0.25) / 16));
    mesh.setContours([]);
    assert.equal(mesh.get_visible(), false);
    assert.equal(mesh.paths.length, 0);
    mesh.dispose();
    mesh.dispose();
    assert.equal(mesh.disposed, true);
  } finally {
    Math.random = random;
    mesh?.dispose();
  }
});
