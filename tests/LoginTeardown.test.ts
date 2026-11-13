import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installLoginTeardown } from '../src/login/LoginTeardown';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

for (const failTheme of [false, true]) {
  test(`login teardown clears disposed displays when theme failure is ${failTheme}`, () => {
    const hooks = new Hooks();
    const cleanups: (() => void)[] = [];
    const errors: string[] = [];
    const removedEvents: string[] = [];
    class LoginFixture {
      loginContainer: object | null = {};
      background: object | null = {};
      recoverDialog: object | null = {};
      registerDialog: object | null = {};
      logoContainer: object | null = {};
      container: object | null = {};
      removedChildren = 0;
      effectsRemoved = 0;
      assetsRemoved = 0;
      resize() {}
      onKeyPress() {}
      onKeyUp() {}
      get_stage() {
        return { removeEventListener: (name: string) => removedEvents.push(name) };
      }
      removeEffects() {
        this.effectsRemoved++;
      }
      removeEmbeddedAssets() {
        this.assetsRemoved++;
      }
      removeChildren() {
        this.removedChildren++;
      }
      removeLoginScreen() {
        assert.equal(this.removedChildren, 1, 'login is removed before theme initialization');
        if (failTheme) throw new Error('theme unavailable');
        this.removeEmbeddedAssets();
        this.removeEffects();
      }
    }
    const api = {
      cls: (name: string) => (name === 'Login' ? LoginFixture : {}),
      around(target: object, key: string, callback: (...args: never[]) => unknown) {
        const remove: () => void = hooks.add(target, key, 'around', callback);
        cleanups.push(remove);
        return remove;
      },
      defer: (cleanup: () => void) => cleanups.push(cleanup),
      log: (message: string) => errors.push(message),
    } as unknown as API;
    bindGameClasses(api);
    installLoginTeardown(api);
    try {
      const login = new LoginFixture();
      login.removeLoginScreen();
      for (const key of [
        'loginContainer',
        'background',
        'recoverDialog',
        'registerDialog',
        'logoContainer',
        'container',
      ] as const)
        assert.equal(login[key], null, `${key} no longer references a disposed display`);
      assert.equal(login.effectsRemoved, 1);
      assert.equal(login.assetsRemoved, 1);
      assert.deepEqual(removedEvents, ['resize', 'keyDown', 'keyUp']);
      assert.deepEqual(errors, failTheme ? ['Gameplay theme setup failed'] : []);
    } finally {
      for (const cleanup of cleanups.reverse()) cleanup();
    }
  });
}
