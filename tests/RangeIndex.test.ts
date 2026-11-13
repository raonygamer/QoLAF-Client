import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installRangeIndex, type DataTable } from '../src/data/RangeIndex';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('range queries scan once, return fresh results, preserve row identity and invalidate on data reload', () => {
  let reads = 0;
  class Manager {
    json: Record<string, DataTable> = {
      Ships: {
        a: {
          get category() {
            reads++;
            return 2;
          },
          name: 'A',
        },
        b: {
          get category() {
            reads++;
            return '2';
          },
          name: 'B',
        },
        c: {
          get category() {
            reads++;
            return 'other';
          },
          name: 'C',
        },
      },
    };
    missing: string[] = [];
    loadRange(table: string, field: string, value: string): DataTable | null {
      if (!Object.hasOwn(this.json, table)) {
        this.missing.push(table);
        return null;
      }
      return Object.fromEntries(
        Object.entries(this.json[table]).filter(
          ([, row]) => Object.hasOwn(row, field) && row[field] == value,
        ),
      );
    }
    cacheCommonData() {}
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const cleanup = hooks.add(target, key, kind, callback);
    cleanups.push(cleanup);
    return cleanup;
  };
  const api = {
    cls: (name: string) => (name === 'data.DataManager' ? Manager : {}),
    around: hook('around'),
    after: hook('after'),
  } as unknown as API;
  bindGameClasses(api);
  installRangeIndex(api);
  const manager = new Manager();
  try {
    const first = manager.loadRange('Ships', 'category', '2')!;
    assert.deepEqual(Object.keys(first), ['a', 'b']);
    assert.equal(reads, 3);
    assert.equal(first.a, manager.json.Ships.a);
    delete first.a;
    const second = manager.loadRange('Ships', 'category', '2')!;
    assert.deepEqual(Object.keys(second), ['a', 'b']);
    assert.notEqual(first, second);
    assert.equal(reads, 3, 'cached query must not read every row again');
    manager.json.Ships.a = { category: '2', name: 'replacement' };
    assert.equal(manager.loadRange('Ships', 'category', '2')!.a, manager.json.Ships.a);
    manager.loadRange('Ships', 'category', 'missing');
    const afterEmpty = reads;
    assert.deepEqual(manager.loadRange('Ships', 'category', 'missing'), {});
    assert.equal(reads, afterEmpty, 'empty matches are cached too');
    manager.json.Ships.d = { category: '2' };
    manager.cacheCommonData();
    assert.deepEqual(Object.keys(manager.loadRange('Ships', 'category', '2')!), ['a', 'b', 'd']);
    manager.json.Ships = { replacement: { category: '2' } };
    assert.deepEqual(Object.keys(manager.loadRange('Ships', 'category', '2')!), ['replacement']);
    assert.equal(manager.loadRange('absent', 'category', '2'), null);
    assert.deepEqual(manager.missing, ['absent'], 'retain native missing-table diagnostic');
    assert.deepEqual(new Manager().loadRange('Ships', 'category', '2')!.a.name, 'A');
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  manager.json.Ships.later = { category: '2' };
  assert.deepEqual(Object.keys(manager.loadRange('Ships', 'category', '2')!), [
    'replacement',
    'later',
  ]);
});
