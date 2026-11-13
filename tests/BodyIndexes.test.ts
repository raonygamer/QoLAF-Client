import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBodyIndexes } from '../src/world/BodyIndexes';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('body lookup indexes match original duplicate precedence, cache late bodies and release rooms', () => {
  class Manager {
    bodies: Array<{ key: string | null }> = [];
    scans = 0;
    getBodyByKey(key: string) {
      this.scans++;
      return this.bodies.find((b) => b.key === key) ?? null;
    }
    dispose() {
      this.bodies = [];
    }
  }
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const register = (kind: string) => (owner: object, key: string, callback: unknown) => {
    const off = hooks.add(owner, key, kind, callback);
    cleanup.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => (name === 'core.solarSystem.BodyManager' ? Manager : {}),
    around: register('around'),
    before: register('before'),
  } as unknown as API;
  bindGameClasses(api);
  installBodyIndexes(api);
  const manager = new Manager();
  const first = { key: 'sun' };
  const last = { key: 'sun' };
  manager.bodies.push(first, last, { key: null });
  try {
    assert.equal(manager.getBodyByKey('sun'), last, 'original initial index uses last duplicate');
    assert.equal(manager.scans, 0);
    assert.equal(manager.getBodyByKey('planet'), null);
    const planet = { key: 'planet' };
    manager.bodies.push(planet);
    assert.equal(manager.getBodyByKey('planet'), planet, 'miss does not cache absence');
    const scans = manager.scans;
    assert.equal(manager.getBodyByKey('planet'), planet);
    assert.equal(manager.scans, scans);
    planet.key = 'renamed';
    assert.equal(manager.getBodyByKey('planet'), null);
    assert.equal(manager.getBodyByKey('renamed'), planet);
    const secondManager = new Manager();
    secondManager.bodies.push(first);
    assert.equal(secondManager.getBodyByKey('sun'), first, 'room indexes are isolated');
    manager.dispose();
    manager.bodies.push(first);
    assert.equal(manager.getBodyByKey('sun'), first, 'disposed index is rebuilt');
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  const scans = manager.scans;
  manager.getBodyByKey('sun');
  assert.equal(manager.scans, scans + 1);
});
