import test from 'node:test';
import assert from 'node:assert/strict';
import { clientLogText } from '../src/diagnostics/ClientLog';

test('log view filters errors and preserves literal exception text and repeats', () => {
  const api = {
    diagnostics: {
      snapshot: () => [
        { time: 0, level: 'info', message: 'plugin loaded', repeats: 1 },
        { time: 1, level: 'error', message: '<font> is not a function\nstack', repeats: 3 },
      ],
    },
  };
  assert.match(clientLogText(api), /plugin loaded/);
  const errors = clientLogText(api, true);
  assert.doesNotMatch(errors, /plugin loaded/);
  assert.match(errors, /×3\n<font> is not a function\nstack/);
});

test('older hosts can still open the diagnostic view', () => {
  assert.equal(clientLogText({}), 'No diagnostics recorded in this session.');
});
