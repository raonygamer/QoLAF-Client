import assert from 'node:assert/strict';
import test from 'node:test';
import type { Drop } from '../src/game/Bindings';
import { dropExpiryAlpha, updateDrop } from '../src/rendering/DropExpiry';

test('expiry pulse follows deadline rather than a free-running tween', () => {
  assert.equal(dropExpiryAlpha(10000), 1);
  assert.equal(dropExpiryAlpha(9600), 0.4);
  assert.equal(dropExpiryAlpha(9200), 1);
  assert.equal(dropExpiryAlpha(0), 1);
  assert.equal(dropExpiryAlpha(-100), 1);
  assert.equal(dropExpiryAlpha(12000), 1, 'extended deadline stops warning');
});

test('drop update retains pickup, per-tick damping, rotation, expiry and culling order', () => {
  const events: string[] = [];
  const position = { x: 2, y: 3 };
  let alpha = 1,
    rotation = 0;
  const drop = {
    g: { time: 400 },
    expireTime: 10000,
    isAddedToCanvas: true,
    speed: { x: 10, y: -5 },
    randAngleSpeed: 0.1,
    nextDistanceCalculation: 66,
    tractorBeamUpdate() {
      events.push('pickup');
    },
    get_pos: () => position,
    set_alpha(value: number) {
      alpha = value;
      events.push('alpha');
    },
    expire() {
      events.push('expire');
    },
    get_rotation: () => rotation,
    set_rotation(value: number) {
      rotation = value;
      events.push('rotation');
    },
    updateIsNear() {
      events.push('cull');
    },
  };
  updateDrop(drop as unknown as Drop);
  assert.deepEqual(position, { x: 12, y: -2 });
  assert.deepEqual(drop.speed, { x: 9, y: -4.5 });
  assert.equal(alpha, 0.4);
  assert.equal(rotation, 0.1);
  assert.equal(drop.nextDistanceCalculation, 33);
  assert.deepEqual(events, ['pickup', 'alpha', 'rotation']);
  events.length = 0;
  drop.g.time = 10001;
  drop.nextDistanceCalculation = 0;
  updateDrop(drop as unknown as Drop);
  assert.deepEqual(events, ['pickup', 'alpha', 'expire', 'rotation', 'cull']);
  assert.equal(alpha, 1);
});
