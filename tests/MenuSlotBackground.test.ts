import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installMenuSlotBackground } from '../src/ship/MenuSlotBackground';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('empty slots retain background through native constructor setter order and later slot changes', () => {
  class Icon {
    _locked = false;
    _inUse = false;
    visible = false;
    bgrBmp = { set_visible: (value: boolean) => (this.visible = value) };
    constructor(locked: boolean, occupied: boolean) {
      this.set_locked(locked);
      this.set_inUse(occupied);
      this.set_locked(locked);
    }
    set_locked(value: boolean) {
      this._locked = value;
      this.visible = value;
      return value;
    }
    set_inUse(value: boolean) {
      this._inUse = value;
      this.visible = !value;
      return value;
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.hud.components.shipMenu.MenuSelectIcon' ? Icon : {}),
    after: (owner: object, key: string, callback: Function) => {
      const off = hooks.add(owner, key, 'after', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installMenuSlotBackground(api);
  try {
    for (const locked of [false, true])
      for (const occupied of [false, true]) {
        const icon = new Icon(locked, occupied);
        assert.equal(icon.visible, locked || !occupied);
        assert.equal(icon.set_inUse(true), true);
        assert.equal(icon.visible, locked);
        assert.equal(icon.set_locked(false), false);
        assert.equal(icon.visible, false);
        icon.set_inUse(false);
        assert.equal(icon.visible, true);
      }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(new Icon(false, false).visible, false, 'unload restores native setter behavior');
});
