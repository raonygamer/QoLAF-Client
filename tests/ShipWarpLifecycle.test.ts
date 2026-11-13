import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installShipWarpLifecycle } from '../src/ship/ShipWarpLifecycle';
import { retainedEmitterLifetime } from '../src/rendering/EmitterLifetime';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('warp increases acceleration, retains effects and releases exactly once on exit or unload', () => {
  class Warp {
    ship = { engine: { acceleration: 12 } };
    warpJumpEffect: Array<{ killEmitter(): void }> = [];
    killed = 0;
    retained = false;
    accelerationAtExit = 0;
    enter() {
      this.retained = retainedEmitterLifetime();
      this.warpJumpEffect = [{ killEmitter: () => this.killed++ }];
    }
    exit() {
      this.accelerationAtExit = this.ship.engine.acceleration;
      for (const emitter of this.warpJumpEffect) emitter.killEmitter();
    }
  }
  const hooks = new Hooks(),
    cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.states.ship.WarpJump' ? Warp : {}),
    around(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'around', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installShipWarpLifecycle(api);
  const completed = new Warp(),
    active = new Warp();
  try {
    completed.enter();
    assert.equal(completed.ship.engine.acceleration, 120);
    assert.equal(completed.retained, true);
    assert.equal(retainedEmitterLifetime(), false);
    completed.exit();
    assert.equal(completed.accelerationAtExit, 12);
    assert.equal(completed.killed, 1);
    assert.equal(completed.warpJumpEffect.length, 0);
    completed.exit();
    assert.equal(completed.killed, 1);
    active.enter();
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(active.ship.engine.acceleration, 12);
  assert.equal(active.killed, 1);
  assert.equal(active.warpJumpEffect.length, 0);
  assert.equal(completed.killed, 1);
  const native = new Warp();
  native.enter();
  assert.equal(native.ship.engine.acceleration, 12);
  assert.equal(native.retained, false);
});
