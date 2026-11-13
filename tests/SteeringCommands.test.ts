import assert from 'node:assert/strict';
import test from 'node:test';
import { steeringCommands } from '../src/aim/SteeringCommands';

test('stopping clears both axes without starting a new turn', () => {
  assert.deepEqual(steeringCommands(true, true, 0, 0.1), [
    { type: 1, active: false },
    { type: 2, active: false },
  ]);
  assert.deepEqual(steeringCommands(true, true, 1, 0.1, true), [
    { type: 1, active: false },
    { type: 2, active: false },
  ]);
});
test('reversing releases opposite steering before the next tick starts the new direction', () => {
  assert.deepEqual(steeringCommands(false, true, 1, 0.1), [{ type: 2, active: false }]);
  assert.deepEqual(steeringCommands(false, false, 1, 0.1), [{ type: 1, active: true }]);
  assert.deepEqual(steeringCommands(true, false, -1, 0.1), [{ type: 1, active: false }]);
  assert.deepEqual(steeringCommands(false, false, -1, 0.1), [{ type: 2, active: true }]);
});
test('exact threshold is neutral and already-correct direction is not resent', () => {
  assert.deepEqual(steeringCommands(true, false, 0.1, 0.1), []);
  assert.deepEqual(steeringCommands(false, true, -0.1, 0.1), []);
  assert.deepEqual(steeringCommands(true, false, 1, 0.1), []);
});
