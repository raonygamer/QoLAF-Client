import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { GameScene, bindGameClasses } from '../src/game/Bindings';
import { installNativeAbilityCooldown } from '../src/hud/NativeAbilityCooldown';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('boost UI padding survives refresh without changing other abilities or accumulating on reload', () => {
  class Hotkey {
    obj: { name: string };
    constructor(
      name: string,
      public _cooldownTime: number,
    ) {
      this.obj = { name };
    }
    set_cooldownTime(value: number) {
      return (this._cooldownTime = value);
    }
  }
  const engine = new Hotkey('Engine', 6000);
  const shield = new Hotkey('Shield', 4000);
  const abilities = { hotkeys: [engine, shield], load() {} };
  const game = { hud: { abilities }, ship: { boostCD: 10000, boostNextRdy: 12345 } };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.scene.Game' ? { TICK_LENGTH: 33 } : {}),
    after: (owner: object, key: string, callback: Function) => {
      const off = hooks.add(owner, key, 'after', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installNativeAbilityCooldown(api, game as unknown as GameScene);
  assert.equal(engine._cooldownTime, 6066);
  assert.equal(shield._cooldownTime, 4000);
  abilities.load();
  abilities.load();
  assert.equal(engine._cooldownTime, 6066);
  const nextEngine = new Hotkey('Engine', 8000);
  abilities.hotkeys = [nextEngine, shield];
  abilities.load();
  assert.equal(nextEngine._cooldownTime, 8066);
  assert.deepEqual(game.ship, { boostCD: 10000, boostNextRdy: 12345 });
  cleanups.reverse().forEach((off) => off());
  cleanups.length = 0;
  assert.equal(nextEngine._cooldownTime, 8000);
  installNativeAbilityCooldown(api, game as unknown as GameScene);
  assert.equal(nextEngine._cooldownTime, 8066);
  nextEngine.set_cooldownTime(9000);
  cleanups.reverse().forEach((off) => off());
  assert.equal(nextEngine._cooldownTime, 9000, 'unload preserves another owner’s later adjustment');
});
