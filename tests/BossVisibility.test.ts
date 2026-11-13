import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { GameScene } from '../src/game/Bindings';
import { installBossVisibility } from '../src/hud/BossVisibility';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('boss bar override follows settings and restores latest native visibility on unload', () => {
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const session = {
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    around(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  const bar = {
    visible: true,
    get_visible() {
      return this.visible;
    },
    set_visible(value: boolean) {
      return (this.visible = value);
    },
  };
  const game = { hud: { bossHealth: bar } } as unknown as GameScene;
  const config = { disable_native_boss_bar: true };
  const original = bar.set_visible;
  const update = installBossVisibility(game, session, config);
  try {
    update();
    assert.equal(bar.visible, false);
    bar.set_visible(true);
    assert.equal(bar.visible, false);
    config.disable_native_boss_bar = false;
    update();
    assert.equal(bar.visible, true);
    config.disable_native_boss_bar = true;
    update();
    bar.set_visible(false);
    config.disable_native_boss_bar = false;
    update();
    assert.equal(bar.visible, false, 'native hidden state must survive toggling the override');
    config.disable_native_boss_bar = true;
    bar.set_visible(true);
    assert.equal(bar.visible, false);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(bar.set_visible, original);
  assert.equal(bar.visible, true, 'unload restores the latest native request');
});
