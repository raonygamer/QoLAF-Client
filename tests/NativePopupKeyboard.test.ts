import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installPopupKeyboard } from '../src/dialogs/NativePopupKeyboard';

test('modal Escape consumes repeats and release without opening the underlying menu', () => {
  const target = new EventTarget();
  let open = true;
  let closes = 0;
  const cleanup = installPopupKeyboard(
    target as unknown as Window,
    () => open,
    () => {
      open = false;
      closes++;
    },
  );
  let leaked = 0;
  target.addEventListener('keydown', () => leaked++);
  target.addEventListener('keyup', () => leaked++);
  const send = (type: string, key = 'Escape') => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { key });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(send('keydown'), true);
  assert.equal(send('keydown'), true);
  assert.equal(send('keyup'), true);
  assert.equal(closes, 1);
  assert.equal(leaked, 0);
  assert.equal(send('keydown'), false);
  assert.equal(leaked, 1);
  open = true;
  assert.equal(send('keydown', 'Enter'), false);
  cleanup();
  assert.equal(send('keydown'), false);
  assert.equal(closes, 1);
});
