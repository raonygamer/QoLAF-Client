import assert from 'node:assert/strict';
import test from 'node:test';
import { RemoteMovementBuffer } from '../src/movement/RemoteMovementBuffer';

test('initial throttle is immediate, subsequent transitions use the source playback delay', () => {
  const buffer = new RemoteMovementBuffer();
  buffer.addHeading({ time: 1000, accelerate: false, deaccelerate: false }, 100);
  buffer.addCommand({ time: 1033, type: 0, active: true }, 110);
  assert.equal(buffer.sample(175)?.accelerate, false);
  assert.equal(buffer.sample(176)?.accelerate, true);
  buffer.addCommand({ time: 1066, type: 8, active: true }, 180);
  assert.equal(buffer.sample(245)?.deaccelerate, false);
  assert.equal(buffer.sample(246)?.deaccelerate, true);
});

test('repeated headings and equal-time revisions do not postpone an existing transition', () => {
  const buffer = new RemoteMovementBuffer();
  buffer.addHeading({ time: 0, accelerate: false, deaccelerate: false }, 0);
  buffer.addCommand({ time: 33, type: 0, active: true }, 10);
  buffer.addHeading({ time: 66, accelerate: true, deaccelerate: false }, 50);
  buffer.addCommand({ time: 66, type: 8, active: true }, 60);
  assert.deepEqual(buffer.sample(75), { accelerate: false, deaccelerate: false });
  assert.deepEqual(buffer.sample(76), { accelerate: true, deaccelerate: true });
});

test('stale commands are consumed without changing state; stale courses are rejected', () => {
  const buffer = new RemoteMovementBuffer();
  buffer.addHeading({ time: 100, accelerate: false, deaccelerate: true }, 0);
  assert.equal(buffer.addCommand({ time: 99, type: 0, active: true }, 1), true);
  assert.equal(buffer.addHeading({ time: 99, accelerate: true, deaccelerate: false }, 1), false);
  assert.deepEqual(buffer.sample(67), { accelerate: false, deaccelerate: true });
  assert.equal(buffer.addCommand({ time: 101, type: 3, active: true }, 2), false);
});

test('boost replaces throttle/brake and stalled or reversed clocks resume from newest state', () => {
  const buffer = new RemoteMovementBuffer();
  buffer.addHeading({ time: 100, accelerate: false, deaccelerate: true }, 100);
  buffer.addCommand({ time: 133, type: 4, active: true }, 110);
  assert.deepEqual(buffer.sample(176), { accelerate: true, deaccelerate: false });
  buffer.addCommand({ time: 166, type: 0, active: false }, 200);
  assert.equal(buffer.sample(1000)?.accelerate, false);
  buffer.addCommand({ time: 199, type: 0, active: true }, 1001);
  assert.equal(buffer.sample(0)?.accelerate, true);
  buffer.reset();
  assert.equal(buffer.sample(10), null);
  assert.equal(buffer.addCommand({ time: 200, type: 0, active: true }, 10), false);
});
