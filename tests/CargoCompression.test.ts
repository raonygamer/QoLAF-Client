import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installCargoCompression } from '../src/cargo/CargoCompression';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('cargo overload label retains native bar cap, centering and hook cleanup', () => {
  class Label {
    constructor(public text = '%') {}
    get_text() {
      return this.text;
    }
    set_text(text: string) {
      return (this.text = text);
    }
    get_width() {
      return this.text.length * 10;
    }
  }
  const game = { get_me: () => ({ compressorLevel: 0 }) };
  class NativeCargo {
    g = game;
    spaceJunkCount = 0;
    compressorCapacities = [100];
    label = new Label();
    barHeight = 0;
    labelX = 0;
    fail = false;
    draw() {
      if (this.fail) throw new Error('draw failed');
      // Native build 564: clamp bar fraction, assign text, then measure it.
      let fraction = this.spaceJunkCount / this.compressorCapacities[0];
      if (fraction > 1) fraction = 1;
      this.barHeight = fraction * 240;
      this.label = new Label('%');
      this.label.set_text(((100 * fraction) | 0) + '%');
      this.labelX = 480 + 40 / 2 - this.label.get_width() / 2;
    }
  }
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) => (name.endsWith('.Cargo') ? NativeCargo : Label),
    around: (target: object, key: string, fn: (...args: never[]) => unknown) => {
      const remove = hooks.add(target, key, 'around', fn);
      cleanups.push(remove);
      return remove;
    },
  } as unknown as API;
  bindGameClasses(api);
  installCargoCompression(api, game as unknown as GameScene);
  const cargo = new NativeCargo();
  try {
    for (const [count, text, height] of [
      [0, '0%', 0],
      [75, '75%', 180],
      [100, '100%', 240],
      [234, '234%', 240],
    ] as const) {
      cargo.spaceJunkCount = count;
      cargo.draw();
      assert.equal(cargo.label.text, text);
      assert.equal(cargo.barHeight, height);
      assert.equal(cargo.labelX + cargo.label.get_width() / 2, 500);
    }
    const other = new NativeCargo();
    other.g = { get_me: game.get_me };
    other.spaceJunkCount = 234;
    other.draw();
    assert.equal(other.label.text, '100%');
    cargo.fail = true;
    assert.throws(() => cargo.draw(), /draw failed/);
    const unrelated = new Label('%');
    unrelated.set_text('100%');
    assert.equal(unrelated.text, '100%');
  } finally {
    cleanups.reverse().forEach((remove) => remove());
  }
  cargo.fail = false;
  cargo.draw();
  assert.equal(cargo.label.text, '100%');
});
