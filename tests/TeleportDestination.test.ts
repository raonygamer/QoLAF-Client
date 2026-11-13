import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installTeleportDestination } from '../src/ship/TeleportDestination';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('target sync preserves course/entry positions while explicit teleport coordinates survive', () => {
  class Teleport {
    targetX = 0;
    targetY = 0;
    s = {
      get_course: () => ({ pos: { x: 125, y: -30 } }),
      engine: { get_pos: () => ({ x: -90, y: 600 }) },
    };
    entered: number[] = [];
    enter() {
      this.entered = [this.targetX, this.targetY];
    }
  }
  class Machine {
    entry = false;
    inState(name: string) {
      return this.entry && name === 'AITeleportEntry';
    }
    changeState(state: Teleport) {
      state.enter();
    }
  }
  class Manager {
    machine = new Machine();
    fail = false;
    syncEnemyTarget(state: Teleport, _start: number) {
      this.machine.changeState(state);
      if (this.fail) throw new Error('sync');
    }
  }
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const classes: Record<string, unknown> = {
    'core.states.StateMachine': Machine,
    'core.states.aistates.AITeleport': Teleport,
    'core.ship.ShipManager': Manager,
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    ...Object.fromEntries(
      ['around', 'before'].map((kind) => [
        kind,
        (owner: object, name: string, callback: unknown) => {
          const off = hooks.add(owner, name, kind, callback);
          cleanups.push(off);
          return off;
        },
      ]),
    ),
  } as unknown as API;
  bindGameClasses(api);
  installTeleportDestination(api);
  try {
    const manager = new Manager();
    for (const entry of [false, true]) {
      manager.machine.entry = entry;
      const state = new Teleport();
      manager.syncEnemyTarget(state, 0);
      assert.deepEqual(state.entered, entry ? [-90, 600] : [125, -30]);
    }
    for (const [x, y] of [
      [0, 0],
      [55, -66],
      [NaN, 77],
      [88, Infinity],
    ]) {
      const state = Object.assign(new Teleport(), { targetX: x, targetY: y });
      manager.machine.changeState(state);
      assert.deepEqual(state.entered, [Number.isFinite(x) ? x : 125, Number.isFinite(y) ? y : -30]);
    }
    manager.fail = true;
    assert.throws(() => manager.syncEnemyTarget(new Teleport(), 0), /sync/);
    const afterFailure = new Teleport();
    manager.machine.changeState(afterFailure);
    assert.deepEqual(
      afterFailure.entered,
      [0, 0],
      'failed sync cannot leak fallback into later explicit teleports',
    );
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const native = new Teleport();
  new Manager().syncEnemyTarget(native, 0);
  assert.deepEqual(native.entered, [0, 0], 'unload restores native behavior');
});
