import { beginKeyCapture, endKeyCapture, isKeyCaptureActive } from '../src/settings/KeyCapture';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installChatOverlayKeyboard } from '../src/chat/ChatOverlayKeyboard';
test('chat opens above overlays, blocks artifact/other editors, and releases keys on blur', () => {
  const target = new EventTarget();
  const document = { activeElement: null as null | { matches(): boolean } };
  Object.assign(target, { document });
  const stage = {},
    capture = {};
  let available = true,
    active = false,
    toggles = 0;
  const off = installChatOverlayKeyboard(
    target as unknown as Window,
    () => available && !isKeyCaptureActive(stage),
    () => active,
    () => false,
    () => {
      toggles++;
      active = !active;
    },
    () => {
      active = false;
    },
  );
  const key = (type: string, name: string, composing = false) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperties(e, {
      key: { value: name },
      isComposing: { value: composing },
      keyCode: { value: 0 },
    });
    target.dispatchEvent(e);
    return e.defaultPrevented;
  };
  for (const screen of ['death', 'settings', 'hangar']) {
    assert.equal(key('keydown', 'Enter'), true, screen);
    key('keydown', 'Enter');
    assert.equal(active, true);
    key('keyup', 'Enter');
    key('keydown', 'Escape');
    key('keyup', 'Escape');
    assert.equal(active, false);
  }
  assert.equal(toggles, 3);
  beginKeyCapture(stage, capture);
  assert.equal(key('keydown', 'Enter'), false, 'keybinding capture owns Enter');
  assert.equal(toggles, 3);
  endKeyCapture(stage, capture);
  available = false;
  assert.equal(key('keydown', 'Enter'), false);
  assert.equal(toggles, 3);
  available = true;
  document.activeElement = { matches: () => true };
  assert.equal(key('keydown', 'Enter'), false);
  document.activeElement = null;
  assert.equal(key('keydown', 'Enter', true), false);
  key('keydown', 'Enter');
  target.dispatchEvent(new Event('blur'));
  key('keydown', 'Enter');
  assert.equal(toggles, 5);
  off();
  assert.equal(key('keydown', 'Enter'), false);
});
