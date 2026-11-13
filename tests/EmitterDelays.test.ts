import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installEmitterDelays } from '../src/rendering/EmitterDelays';
import { EmitterTargets } from '../src/rendering/EmitterTargets';
import type { Raw } from '../src/api/Types';
// @ts-expect-error inspected upstream factory
import makeFactory from './fixtures/UpstreamEmitterFactory.js';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  const targets = new EmitterTargets();
  const pending: Raw[] = [];
  const tween = {
    killTweensOf(callback: Function) {
      for (let i = pending.length - 1; i >= 0; i--)
        if (pending[i].callback === callback) pending.splice(i, 1);
    },
    delayedCall(delay: number, callback: Function, params?: any[], useFrames?: boolean) {
      const handle = { delay, callback, params, useFrames };
      pending.push(handle);
      return handle;
    },
  };
  let loads = 0;
  class DataManager {
    loadKey() {
      loads++;
      return { multiple: true, multipleDelay: 250, multipleRadius: 20, emitters: [] };
    }
  }
  const service = new DataManager();
  const data = { getService: () => service };
  const factory = makeFactory(data, tween);
  factory.resolveTexture = () => null;
  const calls: unknown[][] = [];
  const nativeCreate = factory.create;
  factory.create = (...args: unknown[]) => {
    calls.push(args);
    return nativeCreate(...args);
  };
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const classes: Raw = {
    'core.particle.EmitterFactory': factory,
    'com.greensock.TweenMax': tween,
    'data.DataLocator': data,
    'data.DataManager': DataManager,
  };
  const api = {
    cls: (name: string) => classes[name],
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    log() {},
    before: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    after: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
  } as any;
  class BindingFixture {
    play() {}
    getEmitter() {
      return null;
    }
  }
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? BindingFixture });
  installEmitterDelays(api, targets);
  const game: Raw = {
    leaving: false,
    get_isLeaving() {
      return this.leaving;
    },
  };
  return {
    targets,
    calls,
    pending,
    tween,
    factory,
    game,
    loads: () => loads,
    cleanup: () => cleanups.reverse().forEach((fn) => fn()),
  };
}

test('native multiple effects run once for the same life but skip recycled targets', () => {
  const f = fixture();
  try {
    const target = {};
    f.factory.create('effect', f.game, 10, 20, target, true);
    assert.equal(f.pending.length, 1);
    assert.equal(f.pending[0].delay, 0.25);
    f.pending.shift()!.callback();
    assert.equal(f.loads(), 2);
    assert.equal(f.pending.length, 0, 'native multipleAllowed=false prevents recursion');
    f.factory.create('effect', f.game, 10, 20, target, true);
    f.targets.resetTarget(target);
    f.pending.shift()!.callback();
    assert.equal(f.loads(), 3, 'old callback must not create an effect on the new life');
    f.factory.create('effect', f.game, 10, 20, target, true);
    f.pending.shift()!.callback();
    assert.equal(f.loads(), 5, 'new life can schedule new effects');
  } finally {
    f.cleanup();
  }
});

test('targetless effects and unrelated timers preserve native callbacks and leaving games stop', () => {
  const f = fixture();
  try {
    f.factory.create('effect', f.game, 10, 20, null, true);
    f.pending.shift()!.callback();
    assert.equal(f.loads(), 2);
    const callback = function () {};
    const params = [1, 2];
    const handle = f.tween.delayedCall(3, callback, params, false);
    assert.equal(handle.callback, callback);
    assert.equal(handle.params, params);
    assert.equal(handle.useFrames, false);
    f.pending.length = 0;
    f.factory.create('effect', f.game, 10, 20, {}, true);
    f.game.leaving = true;
    f.pending.shift()!.callback();
    assert.equal(f.loads(), 3);
  } finally {
    f.cleanup();
  }
});

test('delayed effects preserve fractional positions and the destination canvas', () => {
  const f = fixture();
  const random = Math.random;
  Math.random = () => 0.25;
  try {
    const canvas = {};
    f.factory.create('effect', f.game, 10.5, 20.25, null, true, true, true, canvas);
    f.pending.shift()!.callback();
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[1][2], 20.5);
    assert.equal(f.calls[1][3], 30.25);
    assert.equal(f.calls[1][8], canvas);
    assert.equal(f.calls[1][7], false);
  } finally {
    Math.random = random;
    f.cleanup();
  }
});

test('omitted positions use rendered coordinates and unloaded timers cannot create effects', () => {
  const f = fixture();
  const target = { get_renderX: () => 42.5, get_renderY: () => -12.25 };
  f.factory.create('effect', f.game, undefined, undefined, target);
  assert.equal(f.calls[0][2], 42.5);
  assert.equal(f.calls[0][3], -12.25);
  const callback = f.pending[0].callback;
  const loads = f.loads();
  f.cleanup();
  assert.equal(f.pending.length, 0);
  callback();
  assert.equal(f.loads(), loads);
});
