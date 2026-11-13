import assert from 'node:assert/strict';
import test from 'node:test';
import { crossesDeathLine, distanceSquaredToSegment } from '../src/movement/DeathLineCollision';

const wall = { x: 0, y: -100, toX: 0, toY: 100 };

test('full movement sweep blocks tunneling even when both endpoints are outside clearance', () => {
  assert.equal(crossesDeathLine(wall, 100, 0, -100, 0, 5), true);
  assert.equal(crossesDeathLine(wall, 100, 200, -100, 200, 5), false);
});

test('overlap permits strict outward escape but blocks sideways, inward, and center-line crossing', () => {
  assert.equal(crossesDeathLine(wall, 3, 0, 2, 0, 5), false);
  assert.equal(crossesDeathLine(wall, 2, 20, 2, 0, 5), true);
  assert.equal(crossesDeathLine(wall, 1, 0, 2, 0, 5), true);
  assert.equal(crossesDeathLine(wall, -10, 0, 2, 0, 5), true);
  assert.equal(crossesDeathLine(wall, -3, 0, -2, 0, 5), false);
});

test('finite endpoint clearance catches near misses without making an infinite wall', () => {
  assert.equal(crossesDeathLine(wall, 10, 103, -10, 103, 5), true);
  assert.equal(crossesDeathLine(wall, 10, 106, -10, 106, 5), false);
  assert.equal(crossesDeathLine(wall, 5, 20, 5, -20, 5), false);
});

test('zero-length lines use point distance and negative clearance clamps to zero', () => {
  const point = { x: 0, y: 0, toX: 0, toY: 0 };
  assert.equal(crossesDeathLine(point, 10, 1, -10, 1, 2), true);
  assert.equal(crossesDeathLine(point, 10, 1, -10, 1, -2), false);
  assert.equal(distanceSquaredToSegment(3, 4, 0, 0, 0, 0), 25);
});
