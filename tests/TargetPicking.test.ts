import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { Display } from './fixtures/NativeGame';
import { NativeUI } from '../src/ui/NativeUI';
import { TargetSystem } from '../src/target/TargetSystem';
import { installTargetPicking } from '../src/target/TargetPicking';
import { defaults } from '../src/settings/Settings';

test('unit removal clears locked selection before pooled reuse, and new units are immediately clickable', () => {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanups: (() => void)[] = [];
  let reconcile = () => {};
  const canvas = new Display();
  canvas.set_touchable(false);
  const makeUnit = () => {
    const clip = new Display();
    clip.set_touchable(false);
    return { alive: true, pos: { x: 20, y: 0 }, movieClip: clip };
  };
  const first = makeUnit();
  let target: TargetSystem;
  const manager = {
    units: [first],
    add(unit: typeof first) {
      this.units.push(unit);
      return 71;
    },
    remove(unit: typeof first) {
      assert.equal(target.current, null, 'selection must clear before native reset');
      assert.equal(target.locked, false);
      this.units.splice(this.units.indexOf(unit), 1);
      // A pool may reinitialize the same object before the next frame/poll.
      unit.alive = true;
      return 72;
    },
  };
  const game = { canvas, unitManager: manager, me: { ship: { pos: { x: 0, y: 0 } } } };
  target = new TargetSystem(game, { ...defaults });
  const api: any = {
    defer: (fn: () => void) => cleanups.push(fn),
    interval: (fn: () => void) => {
      reconcile = fn;
    },
  };
  for (const kind of ['before', 'after'])
    api[kind] = (object: any, name: string, fn: Function) =>
      cleanups.push(hooks.add(object, name, kind, fn));
  // Exercise NativeUI's real began-phase handler using this fixture's listeners.
  const click = (clip: Display, phase = 'began') => {
    for (const listener of clip.listeners('touch'))
      listener({
        getTouch: (node: Display, requested: string) => node === clip && requested === phase,
      });
  };
  installTargetPicking(game, api, new NativeUI(api), target);
  try {
    click(first.movieClip, 'ended');
    assert.equal(target.current, null);
    click(first.movieClip);
    assert.equal(target.current, first, 'existing units bind immediately');
    target.locked = true;
    const firstLifecycle = target.lifecycle(first);
    assert.equal(manager.remove(first), 72);
    assert.equal(target.lifecycle(first), firstLifecycle + 1);
    assert.equal(first.movieClip.get_touchable(), false);
    assert.equal(manager.add(first), 71);
    assert.equal(target.lifecycle(first), firstLifecycle + 1, 'add keeps the new lifetime');
    assert.equal(target.current, null, 'reused identity does not inherit the selection');
    click(first.movieClip);
    assert.equal(target.current, first);
    target.clear(true);
    const second = makeUnit();
    manager.add(second);
    click(second.movieClip);
    assert.equal(target.current, second, 'no polling delay after add');
    const oldClip = second.movieClip;
    second.movieClip = makeUnit().movieClip;
    reconcile();
    assert.equal(target.current, second, 'texture replacement retains the same target');
    assert.equal(oldClip.get_touchable(), false);
    assert.equal(second.movieClip.get_touchable(), true);
    manager.units.splice(manager.units.indexOf(second), 1);
    reconcile();
    assert.equal(target.current, null, 'fallback handles removals outside UnitManager');
    const late = makeUnit();
    const lateClip = late.movieClip;
    late.movieClip = null as any;
    manager.add(late);
    late.movieClip = lateClip;
    reconcile();
    click(lateClip);
    assert.equal(target.current, late, 'late-created clips remain supported');
    assert.deepEqual(errors, []);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  assert.equal(canvas.get_touchable(), false);
  assert.equal(first.movieClip.get_touchable(), false);
});
