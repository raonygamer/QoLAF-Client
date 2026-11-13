import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installUniqueDropEffects } from '../src/rendering/UniqueDropEffects';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('unique loot scales each new effect group once, including recycled emitter objects', () => {
  class Emitter {
    start = 2;
    finish = 1;
    count = 5;
    get_startSize() {
      return this.start;
    }
    get_finishSize() {
      return this.finish;
    }
    get_maxParticles() {
      return this.count;
    }
    set_startSize(value: number) {
      this.start = value;
    }
    set_finishSize(value: number) {
      this.finish = value;
    }
    set_maxParticles(value: number) {
      this.count = value;
    }
  }
  class Drop {
    effect: Emitter[] | null = null;
    containsUniqueArtifact = true;
    expired = false;
    pool = [new Emitter(), new Emitter()];
    addToCanvasForReal() {
      if (!this.effect && !this.expired) this.effect = this.pool.slice();
      return 'native result';
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanup: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.drops.Drop' ? Drop : {}),
    around: (owner: object, key: string, callback: Function) => {
      const off = hooks.add(owner, key, 'around', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installUniqueDropEffects(api);
  try {
    const unique = new Drop();
    assert.equal(unique.addToCanvasForReal(), 'native result');
    unique.addToCanvasForReal();
    for (const emitter of unique.effect!)
      assert.deepEqual([emitter.start, emitter.finish, emitter.count], [3, 1.5, 7]);
    unique.effect = null;
    for (const emitter of unique.pool) Object.assign(emitter, { start: 2, finish: 1, count: 5 });
    unique.addToCanvasForReal();
    for (const emitter of unique.effect!) assert.equal(emitter.start, 3);
    const normal = new Drop();
    normal.containsUniqueArtifact = false;
    normal.addToCanvasForReal();
    assert.deepEqual(
      normal.effect!.map((e) => e.start),
      [2, 2],
    );
    const expired = new Drop();
    expired.expired = true;
    expired.addToCanvasForReal();
    assert.equal(expired.effect, null);
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  const unhooked = new Drop();
  unhooked.addToCanvasForReal();
  assert.equal(unhooked.effect![0].start, 2);
});
