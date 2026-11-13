import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installReconstructionEffects } from '../src/ship/ReconstructionEffects';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('reconstruction attaches its second effect to the ship without altering other emitter calls', () => {
  const calls: unknown[][] = [];
  const factory = {
    create(...args: unknown[]) {
      calls.push(args);
      return [];
    },
  };
  const destination = '5BSaDIEYj0mEuVkMVp1JGw';
  class Reconstruction {
    s = { g: {}, get_pos: () => ({ x: 123.5, y: -45.25 }) };
    fail = false;
    get_type() {
      return 'AITeleport';
    }
    enter() {
      factory.create('UZ3AiNHAEUmBD4ev0Itu0A', this.s.g, 123, -45, this.s, true);
      factory.create(destination, this.s.g, 0, 0, null, true, false);
      factory.create(destination, {}, 7, 8, null, true);
      if (this.fail) throw new Error('emitter creation');
    }
  }
  const hooks = new Hooks();
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) =>
      name === 'core.states.aistates.AIResurect'
        ? Reconstruction
        : name === 'core.particle.EmitterFactory'
          ? factory
          : {},
    around(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  const original = factory.create;
  const originalType = Reconstruction.prototype.get_type;
  installReconstructionEffects(api);
  try {
    const state = new Reconstruction();
    assert.equal(state.get_type(), 'AIResurect');
    assert.equal(
      ['AITeleport', 'AITeleportEntry', 'AITeleportExit'].includes(state.get_type()),
      false,
      'native destruction must not treat reconstruction as teleportation',
    );
    state.enter();
    assert.deepEqual(calls[1], [destination, state.s.g, 123.5, -45.25, state.s, true, false]);
    assert.deepEqual(calls[0]?.slice(2, 4), [123, -45]);
    assert.deepEqual(calls[2]?.slice(2, 5), [7, 8, null]);
    assert.equal(factory.create, original);
    factory.create(destination, state.s.g, 9, 10, null);
    assert.deepEqual(calls.at(-1)?.slice(2), [9, 10, null]);
    state.fail = true;
    assert.throws(() => state.enter(), /emitter creation/);
    assert.equal(factory.create, original);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(Reconstruction.prototype.get_type, originalType);
  assert.equal(new Reconstruction().get_type(), 'AITeleport');
});
