import assert from 'node:assert/strict';
import test from 'node:test';
import { APIScope } from '../src/api/APIScope';
import type { API } from '../src/api/Types';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('closing a window releases its hooks without removing another owner', () => {
  const hooks = new Hooks();
  const parent: (() => void)[] = [];
  const api = {
    defer: (fn: () => void) => {
      parent.push(fn);
      return fn;
    },
    before: (target: any, key: string, fn: Function) => hooks.add(target, key, 'before', fn),
    after: (target: any, key: string, fn: Function) => hooks.add(target, key, 'after', fn),
    around: (target: any, key: string, fn: Function) => hooks.add(target, key, 'around', fn),
    log: () => assert.fail('unexpected cleanup error'),
  } as unknown as API;
  const node = { value: () => 1 };
  const a = new APIScope(api),
    b = new APIScope(api);
  a.api.around(node, 'value', (next) => next() + 10);
  b.api.around(node, 'value', (next) => next() + 100);
  assert.equal(node.value(), 111);
  a.dispose();
  assert.equal(node.value(), 101);
  a.dispose();
  for (const off of parent.reverse()) off();
  assert.equal(node.value(), 1);
});

test('scope cleanup is reversed, idempotent, and continues after a failing disposer', () => {
  const events: string[] = [];
  const scope = new APIScope({
    defer: () => {},
    log: () => events.push('error'),
  } as unknown as API);
  const first = scope.api.defer(() => events.push('first'));
  scope.api.defer(() => {
    throw Error('failed cleanup');
  });
  scope.api.defer(() => events.push('last'));
  first();
  scope.dispose();
  scope.dispose();
  scope.api.defer(() => events.push('late'));
  assert.deepEqual(events, ['first', 'last', 'error', 'late']);
});
