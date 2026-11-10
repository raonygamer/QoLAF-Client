import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auraPixels as fixture } from './fixtures/AuraPixels';

test('anchor clouds preserve holes, alpha threshold and diagonally separated components', () => {
  const f = fixture();
  f.mask[0][0] = 255;
  f.mask[1][1] = 255;
  // Ring forms one component, with a transparent center.
  for (const [x, y] of [
    [2, 2],
    [3, 2],
    [4, 2],
    [2, 3],
    [4, 3],
    [2, 4],
    [3, 4],
    [4, 4],
  ])
    f.mask[y][x] = 48;
  f.mask[0][4] = 47;
  const groups = f.anchors.points(f.texture);
  assert.deepEqual(
    groups.map((group) => group.length),
    [1, 1, 8],
  );
  for (const point of groups.flat()) {
    const x = Math.round((point.x + 1) * 2.5 - 0.5),
      y = Math.round((point.y + 1) * 2.5 - 0.5);
    assert.ok(f.mask[y][x] >= 48);
  }
  const reads = f.reads();
  assert.equal(f.anchors.points(f.texture), groups);
  assert.equal(f.reads(), reads);
  f.mask[0][0] = 0;
  f.source.register(f.texture, f.bitmap);
  assert.notEqual(f.anchors.points(f.texture), groups);
  assert.deepEqual(
    f.anchors.points(f.texture).map((group) => group.length),
    [1, 8],
  );
  f.source.unregister(f.texture);
  assert.deepEqual(f.anchors.points(f.texture), []);
});

test('rotated atlas mapping uses actual texture axes and coverage centers', () => {
  const f = fixture(4, 2, true);
  f.mask[0][3] = 255;
  assert.deepEqual(f.anchors.points(f.texture), [[{ x: -0.5, y: -0.75 }]]);
});

test('coverage work and cached outputs remain bounded for large and fragmented textures', () => {
  const large = fixture(512, 256);
  large.mask.forEach((row) => row.fill(255));
  const points = large.anchors.points(large.texture).flat();
  assert.ok(points.length > 0 && points.length <= 4096);
  assert.ok(large.reads() <= 96 * 96);
  const fragmented = fixture(96, 96);
  fragmented.mask.forEach((row, y) =>
    row.forEach((_v, x) => {
      if ((x + y) % 2 === 0) row[x] = 255;
    }),
  );
  assert.equal(fragmented.anchors.points(fragmented.texture).length, 32);
});

test('missing or unreadable texture pixels produce no fabricated anchors and retry after upload', () => {
  const f = fixture();
  f.bitmap.getPixel32 = () => {
    throw Error('disposed bitmap');
  };
  assert.deepEqual(f.anchors.points(f.texture), []);
  f.source.register(f.texture, { width: 5, height: 5, getPixel32: () => 0xff000000 });
  assert.equal(f.anchors.points(f.texture)[0].length, 25);
});
