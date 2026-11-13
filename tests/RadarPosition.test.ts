import assert from 'node:assert/strict';
import { test } from 'node:test';
import { radarPosition } from '../src/radar/RadarMiniatures';
test('radar miniature centers, rim projection and fade follow the source radii', () => {
  assert.deepEqual(radarPosition(0, 0), { x: 60, y: 60, alpha: 1, visible: true });
  assert.deepEqual(radarPosition(1250, 0), { x: 90, y: 60, alpha: 1, visible: true });
  assert.deepEqual(radarPosition(3750, 0), { x: 120, y: 60, alpha: 0.5, visible: true });
  assert.equal(radarPosition(5000, 0).visible, false);
  const diagonal = radarPosition(-3000, -3000);
  assert.ok(Math.abs(Math.hypot(diagonal.x - 60, diagonal.y - 60) - 60) < 1e-9);
});

test('radar visibility and alpha use owner distance at exact source boundaries', () => {
  assert.deepEqual(radarPosition(2500, 0), { x: 120, y: 60, alpha: 1, visible: true });
  assert.deepEqual(radarPosition(-5000, 0), { x: 0, y: 60, alpha: 0, visible: false });
  const beforeEdge = radarPosition(0, 4999);
  assert.equal(beforeEdge.visible, true);
  assert.equal(beforeEdge.y, 120);
  assert.ok(Math.abs(beforeEdge.alpha - 1 / 2500) < 1e-12);
  assert.deepEqual(radarPosition(0.0001, 0), { x: 60, y: 60, alpha: 1, visible: true });
});
