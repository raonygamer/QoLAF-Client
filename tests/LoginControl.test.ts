import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoginControl } from '../src/login/LoginControl';

function key(target: EventTarget, type: string, values: Record<string, unknown>) {
  const event = new Event(type);
  for (const [name, value] of Object.entries(values)) Object.defineProperty(event, name, { value });
  target.dispatchEvent(event);
}

test('a brief Control tap cancels the countdown immediately even with a cached native handler', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const target = new EventTarget();
  const native = { onKeyPress() {} };
  target.addEventListener('keydown', native.onKeyPress.bind(native));
  // Replacing the instance method cannot change its already registered callback.
  native.onKeyPress = () => assert.fail('cached native callback should remain unchanged');
  const control = new LoginControl();
  const dispose = control.observe(target);
  let countdown = 3,
    connections = 0,
    chooserVisible = false;
  const timer = setInterval(() => {
    if (--countdown <= 0) connections++;
  }, 1000);
  const unsubscribe = control.onControl(() => {
    if (countdown > 0) {
      clearInterval(timer);
      countdown = 0;
      chooserVisible = true;
    }
  });
  key(target, 'keydown', { key: 'Control', keyCode: 17, ctrlKey: true });
  key(target, 'keyup', { key: 'Control', keyCode: 17, ctrlKey: false });
  assert.equal(chooserVisible, true);
  assert.equal(control.controlDown, false);
  assert.equal(control.startupOverride, true, 'release must not re-enable automatic login');
  t.mock.timers.tick(4000);
  assert.equal(connections, 0);
  unsubscribe();
  dispose();
});

test('startup Control persists through loading and blur; disposed screens receive no callbacks', () => {
  const target = new EventTarget();
  const control = new LoginControl();
  const dispose = control.observe(target);
  key(target, 'keydown', { key: 'Control', keyCode: 17, ctrlKey: true });
  target.dispatchEvent(new Event('blur'));
  assert.equal(control.controlDown, false);
  assert.equal(control.startupOverride, true);
  let notifications = 0;
  const unsubscribe = control.onControl(() => notifications++);
  key(target, 'keydown', { key: 'a', keyCode: 65, ctrlKey: false });
  assert.equal(notifications, 0);
  key(target, 'keydown', { key: 'a', keyCode: 65, ctrlKey: true });
  assert.equal(notifications, 1);
  unsubscribe();
  key(target, 'keydown', { key: 'Control', keyCode: 17, ctrlKey: true });
  assert.equal(notifications, 1);
  dispose();
  key(target, 'keydown', { key: 'Control', keyCode: 17, ctrlKey: true });
  assert.equal(control.startupOverride, false);
});
