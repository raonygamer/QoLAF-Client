import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installSpawnerIndexes } from '../src/world/SpawnerIndexes';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('spawner indexes handle initial pools, provisional IDs, server sync, late additions and removal', () => {
  class Spawner {
    constructor(
      public key: string,
      public id = 0,
    ) {}
    get_id() {
      return this.id;
    }
  }
  class Manager {
    spawners: Spawner[] = [];
    scans = 0;
    getSpawnerByKey(key: string) {
      this.scans++;
      return this.spawners.find((s) => s.key === key) ?? null;
    }
    getSpawnerById(id: number) {
      this.scans++;
      return this.spawners.find((s) => s.id === id) ?? null;
    }
    syncSpawners() {
      this.spawners[0].id = 42;
    }
    removeSpawner(spawner: Spawner) {
      this.spawners.splice(this.spawners.indexOf(spawner), 1);
    }
    dispose() {
      this.spawners = [];
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
    cls: (name: string) => (name === 'core.spawner.SpawnManager' ? Manager : {}),
    around: register('around'),
    before: register('before'),
    after: register('after'),
  } as unknown as API;
  bindGameClasses(api);
  installSpawnerIndexes(api);
  const manager = new Manager();
  const first = new Spawner('first');
  const second = new Spawner('second');
  manager.spawners.push(first, second);
  try {
    assert.equal(manager.getSpawnerByKey('first'), first);
    assert.equal(manager.scans, 0, 'initial key index avoids native scan');
    assert.equal(manager.getSpawnerById(0), first, 'zero retains native first-match behavior');
    manager.syncSpawners();
    assert.equal(manager.getSpawnerById(0), second, 'zero was never cached');
    const scans = manager.scans;
    assert.equal(manager.getSpawnerById(42), first);
    assert.equal(manager.scans, scans, 'sync indexes assigned server ID');
    const late = new Spawner('late', 99);
    manager.spawners.push(late);
    assert.equal(manager.getSpawnerByKey('late'), late);
    assert.equal(manager.getSpawnerById(99), late);
    const afterMiss = manager.scans;
    assert.equal(manager.getSpawnerByKey('late'), late);
    assert.equal(manager.getSpawnerById(99), late);
    assert.equal(manager.scans, afterMiss, 'late registration is remembered');
    late.id = 100;
    assert.equal(manager.getSpawnerById(99), null, 'stale identity is not returned');
    assert.equal(manager.getSpawnerById(100), late);
    manager.removeSpawner(late);
    assert.equal(manager.getSpawnerByKey('late'), null);
    assert.equal(manager.getSpawnerById(100), null);
    manager.dispose();
    const replacement = new Spawner('first', 42);
    manager.spawners.push(replacement);
    assert.equal(
      manager.getSpawnerByKey('first'),
      replacement,
      'disposed index cannot retain old room objects',
    );
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  const before = manager.scans;
  manager.getSpawnerByKey('first');
  assert.equal(manager.scans, before + 1, 'unload restores native lookup');
});
