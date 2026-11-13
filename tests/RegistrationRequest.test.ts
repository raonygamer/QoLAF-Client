import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type Client, type RegisterDialog2 } from '../src/game/Bindings';
import { installRegistrationRequest } from '../src/login/RegistrationRequest';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  class Button {
    enabled = true;
    constructor(public callback: () => void) {}
    set_enabled(value: boolean) {
      this.enabled = value;
    }
  }
  class Input {
    error = '';
    constructor(public text: string) {}
    get_text() {
      return this.text;
    }
    set_error(value: string) {
      this.error = value;
    }
  }
  let cancellations = 0;
  let nativeSubmits = 0;
  const registerButton = new Button(() => {
    nativeSubmits++;
  });
  const cancelButton = new Button(() => {
    cancellations++;
  });
  const requests: Array<{
    email: string;
    password: string;
    success: (client: Client) => void;
    failure: (error: {
      emailError: string | null;
      passwordError: string | null;
      message: string;
    }) => void;
  }> = [];
  const connected: Client[] = [];
  const profiles: Array<[string, string]> = [];
  const dialog = {
    registerButton,
    registerBox: { get_numChildren: () => 1, getChildAt: () => cancelButton },
    emailInput: new Input('user@example.com'),
    nameInput: new Input('Pilot'),
    passwordInput: new Input('password'),
    passwordConfirmInput: new Input('password'),
    username: '',
    client: null,
    status: '',
    trim: (value: string) => value.trim(),
    isValidEmail: (value: string) => value.includes('@'),
    updateStatus(value = '') {
      this.status = value;
    },
    handleConnect(client: Client) {
      connected.push(client);
    },
    onRegisterSimple() {
      nativeSubmits++;
    },
  };
  const quickConnect = {
    simpleRegister(
      _stage: object,
      _gameId: string,
      _userId: string,
      password: string,
      email: string,
      _captcha: null,
      _key: null,
      _extra: null,
      _partner: string,
      _segments: string[],
      success: (client: Client) => void,
      failure: (typeof requests)[number]['failure'],
    ) {
      requests.push({ email, password, success, failure });
    },
  };
  const classes: Record<string, unknown> = {
    Login: { gameId: 'game', partnerId: 'partner' },
    'playerio.PlayerIO': { quickConnect },
    'generics.Localize': { t: (text: string) => text },
    'starling.core.Starling': { get_current: () => ({ get_nativeStage: () => ({}) }) },
    RymdenRunt: { partnerSegmentArray: [] },
    'core.hud.components.LoginButton': Button,
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: (target: object, key: string, callback: unknown) =>
      hooks.add(target, key, 'around', callback),
  } as unknown as API;
  bindGameClasses(api);
  const cleanup = installRegistrationRequest(
    api,
    dialog as unknown as RegisterDialog2,
    (email, password) => profiles.push([email, password]),
  );
  return {
    dialog,
    cancelButton,
    requests,
    connected,
    profiles,
    cleanup,
    cancellations: () => cancellations,
    nativeSubmits: () => nativeSubmits,
  };
}

test('registration rejects mismatched confirmation before contacting the SDK', () => {
  const f = fixture();
  f.dialog.passwordConfirmInput.text = 'different';
  f.dialog.registerButton.callback();
  assert.equal(f.dialog.passwordConfirmInput.error, "Don't match");
  assert.equal(f.requests.length, 0);
  assert.equal(f.dialog.registerButton.enabled, true);
  assert.equal(f.cancelButton.enabled, true);
  f.cleanup();
});

test('registration locks pointer and keyboard submission, then allows retry after failure', () => {
  const f = fixture();
  f.dialog.registerButton.callback();
  f.dialog.onRegisterSimple();
  f.cancelButton.callback();
  assert.equal(f.requests.length, 1);
  assert.equal(f.cancellations(), 0);
  assert.equal(f.dialog.registerButton.enabled, false);
  assert.equal(f.cancelButton.enabled, false);
  f.requests[0].failure({
    emailError: 'Already registered',
    passwordError: null,
    message: 'Invalid',
  });
  assert.equal(f.dialog.emailInput.error, 'Already registered');
  assert.equal(f.dialog.status, '');
  assert.equal(f.cancelButton.enabled, true);
  f.dialog.onRegisterSimple();
  assert.equal(f.requests.length, 2);
  assert.equal(f.nativeSubmits(), 0);
  f.cleanup();
});

test('registration saves the successful profile and remains locked during login', () => {
  const f = fixture();
  f.dialog.registerButton.callback();
  const client = {} as Client;
  f.requests[0].success(client);
  assert.deepEqual(f.profiles, [['user@example.com', 'password']]);
  assert.deepEqual(f.connected, [client]);
  assert.equal(f.dialog.username, 'Pilot');
  assert.equal(f.cancelButton.enabled, false);
  f.dialog.onRegisterSimple();
  assert.equal(f.requests.length, 1);
  f.cleanup();
});

test('unsafe disable restores native controls and ignores late registration callbacks', () => {
  const f = fixture();
  f.dialog.registerButton.callback();
  f.cleanup();
  f.cleanup();
  f.requests[0].success({} as Client);
  f.requests[0].failure({ emailError: 'Late failure', passwordError: null, message: 'Late' });
  assert.deepEqual(f.profiles, []);
  assert.deepEqual(f.connected, []);
  assert.equal(f.dialog.emailInput.error, '');
  assert.equal(f.dialog.registerButton.enabled, true);
  assert.equal(f.cancelButton.enabled, true);
  f.dialog.registerButton.callback();
  f.dialog.onRegisterSimple();
  f.cancelButton.callback();
  assert.equal(f.nativeSubmits(), 2);
  assert.equal(f.cancellations(), 1);
});
