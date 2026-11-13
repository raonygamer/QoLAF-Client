import assert from 'node:assert/strict';
import test from 'node:test';
import { ControllerCapture } from '../src/controller/ControllerCapture';

test('capture waits for held buttons to return to neutral', () => {
  const capture = new ControllerCapture();
  assert.equal(capture.sample({ axes: [], buttons: [{ value: 1 }] }), null);
  assert.equal(capture.sample({ axes: [], buttons: [{ value: 0 }] }), null);
  assert.deepEqual(capture.sample({ axes: [], buttons: [{ value: 1 }] }), {
    kind: 'button',
    index: 0,
  });
});

test('axis capture rejects drift and preserves direction', () => {
  const capture = new ControllerCapture();
  assert.equal(capture.sample({ axes: [0.8], buttons: [] }), null);
  assert.equal(capture.sample({ axes: [0], buttons: [] }), null);
  assert.equal(capture.sample({ axes: [0.4], buttons: [] }), null);
  assert.deepEqual(capture.sample({ axes: [-0.9], buttons: [] }), {
    kind: 'axis',
    index: 0,
    direction: -1,
  });
});
