import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TurretIndex } from '../src/turret/TurretIndex';

test('turret indexes handle late IDs, parent changes, removals and provisional zero IDs', () => {
  const first = { id: 1, parent: 5, sync: 2 },
    second = { id: 0, parent: 5, sync: 3 };
  const objects = [first, second];
  const index = new TurretIndex(
    () => objects,
    (item) => item.id,
    (item) => item.parent,
    (item) => item.sync,
  );
  let lookups = 0;
  const byId = (id: number) =>
    index.findId(id, () => {
      lookups++;
      return objects.find((item) => item.id === id) ?? null;
    });
  assert.equal(byId(1), first);
  assert.equal(lookups, 0);
  byId(0);
  byId(0);
  assert.equal(lookups, 2, 'zero is never cached');
  second.id = 9;
  assert.equal(byId(9), second);
  assert.equal(lookups, 3);
  assert.equal(byId(9), second);
  assert.equal(lookups, 3, 'stable identity skips native scan');
  first.id = 10;
  assert.equal(byId(1), null);
  assert.equal(byId(10), first);
  first.parent = 7;
  assert.equal(
    index.findParent(5, 2, () => null),
    null,
  );
  assert.equal(
    index.findParent(7, 2, () => first),
    first,
  );
  objects.splice(objects.indexOf(first), 1);
  index.removed(first);
  const replacement = { id: 10, parent: 7, sync: 2 };
  objects.push(replacement);
  index.added(replacement);
  assert.equal(byId(10), replacement);
  assert.equal(
    index.findParent(7, 2, () => {
      throw new Error('unneeded scan');
    }),
    replacement,
  );
  index.removed(first);
  assert.equal(byId(10), replacement, 'old removal cannot evict replacement');
});
