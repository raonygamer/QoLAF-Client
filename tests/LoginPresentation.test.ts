import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareLoginPresentation } from '../src/login/LoginPresentation';

function view() {
  return {
    isLoggedIn: false,
    visible: true,
    attached: true,
    get_visible() {
      return this.visible;
    },
    set_visible(value: boolean) {
      this.visible = value;
    },
    get_stage() {
      return this.attached ? {} : null;
    },
  };
}
const unexpectedError = (error: unknown): never => {
  throw error;
};
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('login remains hidden through font preparation and becomes visible after controls attach', async () => {
  const login = view();
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let presented = false;
  prepareLoginPresentation(
    login,
    ready,
    () => {
      assert.equal(login.visible, false);
      presented = true;
    },
    unexpectedError,
  );
  assert.equal(login.visible, false);
  finish();
  await settle();
  assert.equal(presented, true);
  assert.equal(login.visible, true);
});

test('autologin completion never resurrects the old login view', async () => {
  const login = view();
  const cancel = prepareLoginPresentation(login, Promise.resolve(), assert.fail, unexpectedError);
  login.isLoggedIn = true;
  await settle();
  assert.equal(login.visible, false);
  cancel();
  assert.equal(login.visible, false);
});

test('unsafe disable restores visibility and cancels late presentation', async () => {
  const login = view();
  const cancel = prepareLoginPresentation(login, Promise.resolve(), assert.fail, unexpectedError);
  cancel();
  assert.equal(login.visible, true);
  login.visible = false;
  await settle();
  assert.equal(login.visible, false, 'late completion must not overwrite newer UI ownership');
});

test('font failure restores usable vanilla controls and reports the error', async () => {
  const login = view();
  const error = new Error('font failed');
  const errors: unknown[] = [];
  prepareLoginPresentation(login, Promise.reject(error), assert.fail, (value) =>
    errors.push(value),
  );
  await settle();
  assert.equal(login.visible, true);
  assert.deepEqual(errors, [error]);
});
