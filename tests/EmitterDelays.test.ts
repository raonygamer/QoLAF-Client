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
    delayedCall(delay: number, callback: Function, params?: any[], useFrames?: boolean) {
      const handle = { delay, callback, params, useFrames };
      pending.push(handle);
      return handle;
    },
  };
  let loads = 0;
  const data = {
    getService: () => ({
      loadKey() {
        loads++;
        return { multiple: true, multipleDelay: 250, multipleRadius: 20, emitters: [] };
      },
    }),
  };
  const factory = makeFactory(data, tween);
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const classes: Raw = { 'core.particle.EmitterFactory': factory, 'com.greensock.TweenMax': tween };
  const api = {
    cls: (name: string) => classes[name],
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
  } as any;
  installEmitterDelays(api, targets);
  const game: Raw = {
    leaving: false,
    get_isLeaving() {
      return this.leaving;
    },
  };
  return {
    targets,
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

test('nested factories and exceptions restore timer scope and preserve invocation arguments', () => {
  const targets = new EmitterTargets();
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const timers: Raw[] = [];
  const callback = function (this: Raw, value: number) {
    return this.base + value;
  };
  const tween = {
    delayedCall(delay: number, callback: Function, params?: number[]) {
      const handle = { delay, callback, params };
      timers.push(handle);
      return handle;
    },
  };
  const child = {};
  const parent = {};
  const game = { isLeaving: false };
  const factory = {
    create(key: string, g: Raw, x: number, y: number, target: Raw): Raw {
      if (key === 'fail') throw Error('factory failure');
      if (key === 'parent') factory.create('child', g, x, y, child);
      return tween.delayedCall(1, callback, [4]);
    },
  };
  const originalCreate = factory.create;
  const originalDelay = tween.delayedCall;
  installEmitterDelays(
    {
      cls: (name: string) => (name === 'core.particle.EmitterFactory' ? factory : tween),
      around: (target: Raw, key: string, fn: Function) =>
        cleanups.push(hooks.add(target, key, 'around', fn)),
    } as any,
    targets,
  );
  try {
    const result = factory.create('parent', game, 0, 0, parent);
    assert.equal(result, timers[1]);
    targets.resetTarget(child);
    assert.equal(timers[0].callback.call({ base: 10 }, ...timers[0].params), undefined);
    assert.equal(timers[1].callback.call({ base: 10 }, ...timers[1].params), 14);
    assert.throws(() => factory.create('fail', game, 0, 0, parent), /factory failure/);
    const external = tween.delayedCall(2, callback, [8]);
    assert.equal(
      external.callback,
      callback,
      'throwing factory must not leak its target into other timers',
    );
  } finally {
    cleanups.reverse().forEach((fn) => fn());
  }
  assert.equal(factory.create, originalCreate);
  assert.equal(tween.delayedCall, originalDelay);
});
