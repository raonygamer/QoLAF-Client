import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuraPulses, installAuraPulses } from '../src/rendering/AuraPulses';
import type { Raw } from '../src/api/Types';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
function fixture() {
  let enabled = true;
  const colorCalls: number[][] = [];
  const pulses = new AuraPulses(() => enabled, {
    interpolateColor: (...args: number[]) => {
      colorCalls.push(args);
      return 0x123456;
    },
  });
  const emitter: Raw = {
    timeElapsed: 0,
    _startSize: 2,
    _finishSize: 4,
    _startColor: 0x11,
    _finishColor: 0x22,
  };
  const particle: Raw = {
    startAlpha: 0.8,
    set_scaleX(value: number) {
      this.scaleX = value;
    },
    set_scaleY(value: number) {
      this.scaleY = value;
    },
    set_color(value: number) {
      this.color = value;
    },
  };
  return {
    pulses,
    emitter,
    particle,
    colorCalls,
    disable: () => {
      enabled = false;
    },
  };
}

test('rarity pulse eases in over 20 percent and out over 80 percent of particle life', () => {
  const { pulses, emitter, particle } = fixture();
  for (const rarity of [2, 3, 4, 5]) {
    pulses.prepare(emitter, rarity);
    for (const [age, alpha] of [
      [0, 0],
      [0.1, 0.4],
      [0.2, 0.8],
      [0.6, 0.4],
      [1, 0],
      [2, 0],
      [-1, 0],
    ]) {
      near(pulses.apply(emitter, particle, 1 - age, 0.7), alpha);
    }
    assert.equal(particle.scaleX, undefined, 'ordinary pulse retains native size and tint');
    assert.equal(particle.color, undefined);
  }
});

test('blue aura uses one six-second breath with source size, tint and cosine envelope', () => {
  const { pulses, emitter, particle, colorCalls } = fixture();
  pulses.prepare(emitter, 1);
  for (const [time, size, alpha] of [
    [0, 3, 0.8],
    [1500, 3.054, 0.84],
    [3000, 3, 0.8],
    [4500, 2.946, 0.76],
    [6000, 3, 0.8],
  ]) {
    emitter.timeElapsed = time;
    near(pulses.apply(emitter, particle, 0.5, 0.4), alpha);
    near(particle.scaleX, size);
    near(particle.scaleY, size);
    assert.equal(particle.color, 0x123456);
  }
  assert.ok(colorCalls.every((args) => args[0] === 0x11 && args[1] === 0x22 && args[2] === 0.42));
  near(pulses.apply(emitter, particle, 1, 1), 0);
  near(pulses.apply(emitter, particle, 0, 0), 0);
  emitter.mirrorY = true;
  pulses.apply(emitter, particle, 0.5, 0.4);
  near(particle.scaleY, -3);
});

test('setting and pool release leave native alpha and particle properties untouched', () => {
  const { pulses, emitter, particle, disable } = fixture();
  assert.equal(pulses.apply(emitter, particle, 0.5, 0.37), 0.37);
  pulses.prepare(emitter, 1);
  pulses.release(emitter);
  assert.equal(pulses.apply(emitter, particle, 0.5, 0.37), 0.37);
  pulses.prepare(emitter, 1);
  disable();
  assert.equal(pulses.apply(emitter, particle, 0.5, 0.37), 0.37);
  assert.equal(particle.color, undefined);
  assert.equal(particle.scaleX, undefined);
});

test('native factory arguments select blue breathing and live settings apply without recreating emitters', () => {
  class Emitter {
    dispose() {}
  }
  const emitter = new Emitter() as Raw;
  Object.assign(emitter, { timeElapsed: 0, _startSize: 2, _finishSize: 2 });
  const settings = { disableRemasteredAuras: false };
  const factory = {
    createRareType(_game: Raw, _target: Raw, _rarity: number) {
      return [emitter];
    },
  };
  const classes: Raw = {
    'core.particle.EmitterFactory': factory,
    'core.particle.Emitter': Emitter,
    'generics.Color': { interpolateColor: () => 0 },
    'core.scene.SceneBase': { clientSettings: settings },
  };
  const hooks = new Hooks();
  const cleanup: Array<() => void> = [];
  const pulses = installAuraPulses({
    cls: (key: string) => classes[key],
    after: (target: Raw, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, 'after', fn)),
    before: (target: Raw, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, 'before', fn)),
  } as any)!;
  const { particle } = fixture();
  try {
    factory.createRareType({}, {}, 1);
    near(pulses.apply(emitter, particle, 0.5, 0.4), 0.8);
    settings.disableRemasteredAuras = true;
    near(pulses.apply(emitter, particle, 0.5, 0.4), 0.4);
    settings.disableRemasteredAuras = false;
    near(pulses.apply(emitter, particle, 0.5, 0.4), 0.8);
    emitter.dispose();
    near(pulses.apply(emitter, particle, 0.5, 0.4), 0.4);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
