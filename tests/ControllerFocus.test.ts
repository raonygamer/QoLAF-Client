import assert from 'node:assert/strict';
import test from 'node:test';
import { hasControllerFocus } from '../src/controller/ControllerFocus';

test('game frame accepts focused container but excludes other windows and parent text fields', () => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const body = {};
  const frame = {};
  let focused = true;
  const parentDocument = { hasFocus: () => focused, activeElement: body, body };
  const document = { hidden: false, hasFocus: () => false };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { parent: { document: parentDocument }, frameElement: frame },
  });
  try {
    assert.equal(hasControllerFocus(), true);
    parentDocument.activeElement = frame;
    assert.equal(hasControllerFocus(), true);
    parentDocument.activeElement = {};
    assert.equal(hasControllerFocus(), false);
    parentDocument.activeElement = body;
    focused = false;
    assert.equal(hasControllerFocus(), false);
    focused = true;
    document.hidden = true;
    assert.equal(hasControllerFocus(), false);
  } finally {
    for (const [key, descriptor] of [
      ['document', savedDocument],
      ['window', savedWindow],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
