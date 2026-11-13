import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installMapDeathLineLifecycle } from '../src/map/MapDeathLineLifecycle';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { Display } from './fixtures/NativeGame';

test('map death-line disposal detaches before pool return, including teardown without a pool', () => {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanups: (() => void)[] = [];
  let returned = 0;
  class DeathLine {
    line = new Display();
    g: { linePool: { removeLine(line: Display): void } | null } = {
      linePool: {
        removeLine: (line: Display) => {
          assert.equal(line.parent, null, 'pool may immediately reuse the line');
          assert.equal(line.disposed, false, 'shared pooled geometry must survive');
          returned++;
        },
      },
    };
    dispose() {
      this.g.linePool?.removeLine(this.line);
      return 42;
    }
  }
  const api = {
    cls: () => DeathLine,
    before: (target: object, key: string, fn: (...args: never[]) => unknown) => {
      const off = hooks.add(target, key, 'before', fn);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installMapDeathLineLifecycle(api);
  try {
    const map = new Display();
    const marker = new DeathLine();
    map.addChild(marker.line);
    assert.equal(marker.dispose(), 42);
    assert.equal(map.children.length, 0);
    assert.equal(returned, 1);
    const withoutPool = new DeathLine();
    withoutPool.g.linePool = null;
    map.addChild(withoutPool.line);
    withoutPool.dispose();
    assert.equal(map.children.length, 0);
    assert.equal(withoutPool.line.disposed, false);
    assert.deepEqual(errors, []);
  } finally {
    cleanups.reverse().forEach((fn) => fn());
  }
});
