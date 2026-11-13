import assert from 'node:assert/strict';
import test from 'node:test';
import { formatHeadingInput } from '../src/network/HeadingInput';

test('heading input shows both binding slots and current physical state', () => {
  let held = true;
  const bindings = {
    getKeyName(command: number, slot: number) {
      return command === 11 ? (slot === 1 ? 'W' : 'Up') : slot === 1 ? '' : 'Down';
    },
    isInputDown(command: number) {
      return command === 11 && held;
    },
  };
  assert.equal(
    formatHeadingInput(bindings),
    'physical keybinds  accel [W/Up] DOWN   decel [Down] UP',
  );
  held = false;
  assert.equal(
    formatHeadingInput(bindings),
    'physical keybinds  accel [W/Up] UP   decel [Down] UP',
  );
});

test('unbound controls and missing input state remain distinguishable', () => {
  assert.equal(formatHeadingInput(null), 'physical keybinds  unavailable');
  assert.equal(
    formatHeadingInput({ getKeyName: () => null, isInputDown: () => false }),
    'physical keybinds  accel [unbound] UP   decel [unbound] UP',
  );
});
