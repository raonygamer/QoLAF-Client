import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawDropFrame } from '../src/rendering/DropFrames';
import type { Drop } from '../src/game/Bindings';

test('loot predicts each display frame without changing pickup simulation coordinates', () => {
  const position = { x: 100, y: 200 };
  const speed = { x: 9, y: -3 };
  const timing = { accumulator: 0 };
  let x = 0,
    y = 0;
  const drop = {
    g: { gameStateMachine: timing },
    get_pos: () => position,
    speed,
    _mc: {
      set_x: (value: number) => {
        x = value;
      },
      set_y: (value: number) => {
        y = value;
      },
    },
  } as unknown as Drop;
  for (const fps of [60, 120, 180]) {
    let previous = -Infinity;
    for (let time = 0; time < 33; time += 1000 / fps) {
      timing.accumulator = time;
      drawDropFrame(drop);
      assert.equal(x, 100 + (9 * time) / 33);
      assert.equal(y, 200 - (3 * time) / 33);
      assert.ok(x > previous);
      previous = x;
    }
  }
  assert.deepEqual(position, { x: 100, y: 200 });
  assert.deepEqual(speed, { x: 9, y: -3 });
  timing.accumulator = 100;
  drawDropFrame(drop);
  assert.equal(x, 109);
  timing.accumulator = -1;
  drawDropFrame(drop);
  assert.equal(x, 100);
});
