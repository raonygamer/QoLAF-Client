import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuraTextureContours } from '../src/rendering/AuraTextureContours';
import { auraPixels } from './fixtures/AuraPixels';

function verifyCoverage(
  f: ReturnType<typeof auraPixels>,
  contours: ReturnType<AuraTextureContours['contours']>,
) {
  const mapping = f.source.mapping(f.texture)!;
  for (const loop of contours) {
    assert.ok(loop.length >= 4 && loop.length <= 768);
    for (let i = 0; i < loop.length; i++) {
      const a = mapping.uv(loop[i])!,
        b = mapping.uv(loop[(i + 1) % loop.length])!;
      for (let t = 0; t < 1; t += 0.02)
        assert.ok(mapping.covered(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }
}

test('contours preserve outer silhouette and holes with covered closed segments', () => {
  for (const rotated of [false, true]) {
    const f = auraPixels(7, 7, rotated);
    f.mask.forEach((row) => row.fill(255));
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) f.mask[y][x] = 0;
    const contours = new AuraTextureContours(f.source);
    const loops = contours.contours(f.texture);
    assert.equal(loops.length, 2);
    verifyCoverage(f, loops);
    assert.equal(contours.contours(f.texture), loops);
    f.source.unregister(f.texture);
    assert.deepEqual(contours.contours(f.texture), []);
  }
});

test('concave turns and diagonal islands do not invent transparent bridges', () => {
  const f = auraPixels(7, 7);
  for (let y = 0; y < 5; y++) f.mask[y][0] = 255;
  for (let x = 0; x < 5; x++) f.mask[4][x] = 255;
  f.mask[5][5] = 255;
  const loops = new AuraTextureContours(f.source).contours(f.texture);
  assert.equal(loops.length, 2);
  verifyCoverage(f, loops);
});

test('native-pixel validation rejects a narrow transparent notch missed by the coarse mask', () => {
  const f = auraPixels(512, 32);
  f.mask.forEach((row) => {
    row.fill(255);
    row[100] = 0;
  });
  const mapping = f.source.mapping(f.texture)!;
  assert.ok(
    mapping.filled.every((value) => value === 1),
    '96-cell coverage intentionally misses this one-pixel notch',
  );
  assert.deepEqual(new AuraTextureContours(f.source).contours(f.texture), []);
});

test('large segments, long outlines and component count stay bounded', () => {
  const huge = auraPixels(8192, 8);
  huge.mask.forEach((row) => row.fill(255));
  assert.deepEqual(new AuraTextureContours(huge.source).contours(huge.texture), []);
  const snake = auraPixels(96, 96);
  for (let x = 0; x < 95; x += 2) {
    for (let y = 0; y < 96; y++) snake.mask[y][x] = 255;
    if (x < 94) snake.mask[x % 4 === 0 ? 95 : 0][x + 1] = 255;
  }
  assert.deepEqual(new AuraTextureContours(snake.source).contours(snake.texture), []);
  const islands = auraPixels(96, 96);
  islands.mask.forEach((row, y) =>
    row.forEach((_v, x) => {
      if ((x + y) % 2 === 0) row[x] = 255;
    }),
  );
  assert.equal(new AuraTextureContours(islands.source).contours(islands.texture).length, 32);
});
