import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundaryDirection, createBoundary } from '../src/explore/MapBoundary';

test('boundary direction rejects isolated cells and handles the horizontal seam', () => {
  const matrix = Array.from({ length: 130 }, () => Array<number>(45).fill(1));
  assert.equal(boundaryDirection(matrix, [{ x: 30, y: 20 }]), -1);
  matrix[30][21] = -1;
  assert.equal(boundaryDirection(matrix, [{ x: 30, y: 20 }]), 0);
  matrix[30][21] = 0;
  assert.equal(boundaryDirection(matrix, [{ x: 30, y: 20 }]), 4);
  assert.equal(
    boundaryDirection(matrix, [
      { x: 129, y: 20 },
      { x: 0, y: 20 },
    ]),
    6,
  );
  assert.equal(
    boundaryDirection(matrix, [
      { x: 0, y: 20 },
      { x: 129, y: 20 },
    ]),
    2,
  );
  assert.equal(
    boundaryDirection(matrix, [
      { x: 10, y: 10 },
      { x: 30, y: 20 },
    ]),
    -1,
  );
});

test('shell generation rejects missing starts, invalid directions, dead ends and cycles', () => {
  type Point = { x: number; y: number };
  let start = true,
    direction = 0,
    next = true,
    close = false;
  let attempts = 0,
    narrowPasses = 0,
    processed = 0;
  const map = {
    getStartPoint(points: Point[]) {
      if (start) points.push({ x: 0, y: 0 });
    },
    isDone(points: Point[]) {
      return close && points.length === 10;
    },
    getDirection() {
      return direction;
    },
    getNextPoint() {
      attempts++;
      return next ? { x: 0, y: 0 } : null;
    },
    removeNarrows() {
      narrowPasses++;
    },
    postProccessEdge() {
      processed++;
    },
  };
  start = false;
  assert.equal(createBoundary(map, 1), null);
  start = true;
  direction = -1;
  assert.equal(createBoundary(map, 1), null);
  assert.equal(attempts, 0);
  direction = 0;
  next = false;
  assert.equal(createBoundary(map, 1), null);
  next = true;
  attempts = 0;
  assert.equal(createBoundary(map, 1), null);
  assert.equal(attempts, 130 * 45 * 8);
  assert.equal(processed, 0);
  close = true;
  assert.equal(createBoundary(map, 1)?.length, 10);
  assert.equal(narrowPasses, 3);
  assert.equal(processed, 1);
});
