import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type RecoverDialog } from '../src/game/Bindings';
import { installRecoveryRequest } from '../src/login/RecoveryRequest';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('recovery blocks duplicate button/Enter requests until failure or success dismissal', () => {
  const hookErrors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => hookErrors.push(error));
  const cleanups: (() => void)[] = [];
  let requestCount = 0;
  let success: () => void = () => {};
  let failure: (error: { message: string }) => void = () => {};
  let throwRequest = false;
  const quickConnect = {
    simpleRecoverPassword(_gameId: string, _email: string,
      accepted: () => void, rejected: (error: { message: string }) => void) {
      requestCount++;
      if (throwRequest) throw new Error('transport failure');
      success = accepted;
      failure = rejected;
    },
  };
  const login = { currentState: 'password_recover' };
  const api = {
    cls: (name: string) => name === 'Login' ? login
      : name === 'playerio.PlayerIO' ? { quickConnect } : {},
    around: (target: object, name: string, callback: (...args: never[]) => unknown) => {
      const remove = hooks.add(target, name, 'around', callback);
      cleanups.push(remove);
      return remove;
    },
    after: (target: object, name: string, callback: (...args: never[]) => unknown) => {
      const remove = hooks.add(target, name, 'after', callback);
      cleanups.push(remove);
      return remove;
    },
  } as unknown as API;
  bindGameClasses(api);
  class Button {
    enabled = true;
    callback = () => {};
    set_enabled(value: boolean) { this.enabled = value; return value; }
  }
  const recoverButton = new Button();
  const cancelButton = new Button();
  let email = 'captain@example.invalid';
  let errorText = '';
  let popups = 0;
  const dialog = {
    recoverButton, cancelButton,
    get_visible: () => true,
    onRecover() {
      if (!email.trim()) { errorText = 'Enter email address'; return; }
      recoverButton.set_enabled(false);
      errorText = '';
      quickConnect.simpleRecoverPassword('game', email,
        () => { popups++; },
        (error) => { errorText = error.message; recoverButton.set_enabled(true); });
    },
  };
  recoverButton.callback = dialog.onRecover.bind(dialog);
  const nativeCallback = recoverButton.callback;
  const nativeMethod = dialog.onRecover;
  const dispose = installRecoveryRequest(api, dialog as unknown as RecoverDialog);
  try {
    email = '';
    dialog.onRecover();
    assert.equal(requestCount, 0);
    assert.equal(cancelButton.enabled, true);
    email = 'captain@example.invalid';
    recoverButton.callback();
    assert.equal(requestCount, 1);
    assert.equal(cancelButton.enabled, false);
    dialog.onRecover();
    recoverButton.callback();
    assert.equal(requestCount, 1, 'Enter and captured button callback share the guard');
    failure({ message: 'Try again' });
    assert.equal(errorText, 'Try again');
    assert.equal(cancelButton.enabled, true);
    assert.equal(recoverButton.enabled, true);
    dialog.onRecover();
    success();
    assert.equal(popups, 1);
    dialog.onRecover();
    assert.equal(requestCount, 2, 'success popup still owns the pending interval');
    recoverButton.set_enabled(true); // Native popup close callback.
    assert.equal(cancelButton.enabled, true);
    throwRequest = true;
    assert.throws(() => dialog.onRecover(), /transport failure/);
    assert.equal(cancelButton.enabled, true);
    assert.equal(recoverButton.enabled, true);
    throwRequest = false;
    dialog.onRecover();
    dispose();
    assert.equal(cancelButton.enabled, true);
    assert.equal(recoverButton.enabled, true);
    success();
    failure({ message: 'Late response' });
    assert.equal(popups, 1, 'retired dialog ignores late replies');
    assert.notEqual(errorText, 'Late response');
    assert.equal(recoverButton.callback, nativeCallback);
    assert.equal(dialog.onRecover, nativeMethod);
    assert.equal(hookErrors.length, 2, 'only the injected transport exception reaches both hook boundaries');
    assert.ok(hookErrors.every((error) => error instanceof Error && error.message === 'transport failure'));
    dispose();
  } finally {
    dispose();
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});
