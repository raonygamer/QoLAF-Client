import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installPowerNumber } from '../src/hud/PowerNumber';
// @ts-expect-error real host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('power display uses original compact formatting without changing native updates', () => {
  const game = {};
  class Bar {
    g = game;
    power = 12.34;
    nativeUpdates = 0;
    text = '';
    heatNumber = {
      get_text: () => this.text,
      set_text: (text: string) => (this.text = text),
    };
    update() {
      this.nativeUpdates++;
      this.heatNumber.set_text(String(Math.round(100 * this.power)));
    }
  }
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: () => Bar,
    after: (target: object, key: string, fn: (...args: never[]) => unknown) => {
      const remove = hooks.add(target, key, 'after', fn);
      cleanups.push(remove);
      return remove;
    },
  } as unknown as API;
  bindGameClasses(api);
  installPowerNumber(api, game as GameScene);
  const bar = new Bar();
  try {
    for (const [power, expected] of [
      [12.34, '1.2k'],
      [0.4, '40'],
      [0, '0'],
      [9999.5, '1M'],
    ] as const) {
      bar.power = power;
      const before = bar.nativeUpdates;
      bar.update();
      assert.equal(bar.nativeUpdates, before + 1);
      assert.equal(bar.text, expected);
      assert.equal(bar.power, power);
    }
    const unrelated = new Bar();
    unrelated.g = {};
    unrelated.update();
    assert.equal(unrelated.text, '1234');
  } finally {
    cleanups.reverse().forEach((remove) => remove());
  }
  bar.power = 12.34;
  bar.update();
  assert.equal(bar.text, '1234');
});
