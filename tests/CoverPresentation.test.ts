import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { CoverPresentation } from '../src/login/CoverPresentation';

test('scene teardown waits for the faded cover to be opaque and presented', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const listeners = new Set<() => void>();
  let frame = 0;
  let opaque = false;
  let closed = false;
  const renderer = {
    get_contextValid: () => true,
    get_frameID: () => frame,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    setRequiresRedraw() {},
  };
  bindGameClasses({ cls: () => ({ get_current: () => renderer }) } as unknown as API);
  const presentation = new CoverPresentation();
  presentation.start(
    () => {},
    () => {
      closed = true;
    },
    () => opaque,
  );
  for (const listener of [...listeners]) listener();
  frame++;
  t.mock.timers.tick(125);
  assert.equal(closed, false);
  opaque = true;
  for (const listener of [...listeners]) listener();
  assert.equal(closed, false, 'render event precedes presentation');
  t.mock.timers.tick(1);
  assert.equal(closed, false, 'earlier translucent frames do not prove opaque presentation');
  for (const listener of [...listeners]) listener();
  frame++;
  t.mock.timers.tick(1);
  assert.equal(closed, true);
  assert.equal(listeners.size, 0);
});
