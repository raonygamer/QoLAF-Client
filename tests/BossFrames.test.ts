import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BossPoseHistory, bossComponentPose } from '../src/rendering/BossFrames';

test('new bosses use their authoritative spawn instead of interpolating from the origin', () => {
  const history = new BossPoseHistory();
  const spawn = { x: 4500, y: -900, rotation: 1 };
  assert.deepEqual(history.sample(0.2, spawn), spawn);
  history.record(spawn);
  for (const alpha of [0, 0.2, 0.8, 1]) assert.deepEqual(history.sample(alpha, spawn), spawn);
});

test('multipart mounts follow the same smooth root pose at 60, 120 and 180 Hz', () => {
  for (const fps of [60, 120, 180]) {
    const history = new BossPoseHistory();
    history.record({ x: 1000, y: 2000, rotation: 0 });
    history.record({ x: 1033, y: 2010, rotation: 0.1 });
    let lastX = -Infinity;
    for (let milliseconds = 0; milliseconds < 33; milliseconds += 1000 / fps) {
      const parent = history.sample(milliseconds / 33, { x: 0, y: 0, rotation: 0 });
      const part = bossComponentPose(parent, { x: 50, y: -20 }, 0.4);
      assert.ok(part.x > lastX);
      lastX = part.x;
      assert.ok(
        Math.abs(Math.hypot(part.x - parent.x, part.y - parent.y) - Math.hypot(50, 20)) < 1e-9,
      );
      assert.equal(part.rotation, parent.rotation + 0.4);
    }
  }
});

test('teleport snaps both endpoints and rotation crosses the angle seam by the shortest arc', () => {
  const history = new BossPoseHistory();
  history.record({ x: 10, y: 20, rotation: Math.PI - 0.1 });
  history.record({ x: 20, y: 30, rotation: -Math.PI + 0.1 });
  assert.ok(Math.abs(history.sample(0.5, { x: 0, y: 0, rotation: 0 }).rotation - Math.PI) < 1e-9);
  const destination = { x: 9000, y: -3000, rotation: 1 };
  history.snap(destination);
  assert.deepEqual(history.sample(0, destination), destination);
  assert.deepEqual(history.sample(0.9, destination), destination);
});
