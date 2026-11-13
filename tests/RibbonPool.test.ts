import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installRibbonPool } from '../src/rendering/RibbonPool';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

class Trail {
  poolIndex = -1;
  mNumRibbonSegments = 2;
  mRibbonSegments = Array.from({ length: 2 }, () => ({
    x0: 90,
    y0: 91,
    x1: 92,
    y1: 93,
    alpha: 0.8,
  }));
  alphaArray = [0.8, 0.8];
  vertices = [
    [90, 91],
    [92, 93],
    [90, 91],
    [92, 93],
  ];
  alphas = [0.8, 0.8, 0.8, 0.8];
  mIsPlaying = true;
  visible = true;
  mFollowingRibbonSegmentLine: unknown = ['old owner'];
  mFollowingEnable = false;
  mMovingRatio = 0.8;
  mAlphaRatio = 0.2;
  mRepeat = true;
  alpha = 0.3;
  color = 0x123456;
  set_visible(value: boolean) {
    this.visible = value;
  }
  set_alpha(value: number) {
    this.alpha = value;
  }
  set_color(value: number) {
    this.color = value;
  }
  setVertexPosition(index: number, x: number, y: number) {
    this.vertices[index] = [x, y];
  }
  setVertexAlpha(index: number, value: number) {
    this.alphas[index] = value;
  }
  resetAllTo(x0: number, y0: number, x1: number, y1: number, alpha = 1) {
    // Native reset changes segment history but leaves uploaded vertices stale.
    this.alphaArray.length = 0;
    if (this.mNumRibbonSegments > this.mRibbonSegments.length) return;
    for (let index = 0; index < this.mNumRibbonSegments; index++)
      Object.assign(this.mRibbonSegments[index], { x0, y0, x1, y1, alpha });
  }
}

class Pool {
  activeRibbonTrails: Trail[] = [];
  inactiveRibbonTrails: Trail[] = [];
  getRibbonTrail() {
    const trail = this.inactiveRibbonTrails.pop() ?? new Trail();
    trail.poolIndex = this.activeRibbonTrails.length;
    this.activeRibbonTrails.push(trail);
    return trail;
  }
  removeRibbonTrail(trail: Trail) {
    const index = trail.poolIndex;
    if (
      index < 0 ||
      index >= this.activeRibbonTrails.length ||
      this.activeRibbonTrails[index] !== trail
    )
      return;
    const last = this.activeRibbonTrails.pop()!;
    if (last !== trail) {
      this.activeRibbonTrails[index] = last;
      last.poolIndex = index;
    }
    trail.poolIndex = -1;
    this.inactiveRibbonTrails.push(trail);
  }
  reclaimOrphans() {
    const count = this.activeRibbonTrails.length;
    this.inactiveRibbonTrails.push(...this.activeRibbonTrails.splice(0));
    return count;
  }
}

function fixture() {
  const hooks = new Hooks();
  const cleanups: Function[] = [];
  const classes: Record<string, any> = {
    'extensions.RibbonTrail': Trail,
    'core.pools.RibbonTrailPool': Pool,
  };
  const api = {
    cls: (name: string) => classes[name],
    after: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    around: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
  } as unknown as API;
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? class BindingFixture {} });
  installRibbonPool(api);
  return { pool: new Pool(), dispose: () => cleanups.reverse().forEach((fn) => fn()) };
}

function assertReset(trail: Trail) {
  assert.equal(trail.mIsPlaying, false);
  assert.equal(trail.visible, false);
  assert.equal(trail.mFollowingRibbonSegmentLine, null);
  assert.equal(trail.mFollowingEnable, true);
  assert.equal(trail.mMovingRatio, 0.5);
  assert.equal(trail.mAlphaRatio, 0.95);
  assert.equal(trail.mRepeat, false);
  assert.equal(trail.alpha, 1);
  assert.equal(trail.color, 0xffffff);
  assert.deepEqual(trail.vertices, [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  assert.deepEqual(trail.alphas, [0, 0, 0, 0]);
  assert.deepEqual(trail.alphaArray, [0, 0]);
}

test('ribbon checkout and return clear previous-owner state before any simulation tick', () => {
  const { pool, dispose } = fixture();
  try {
    const trail = pool.getRibbonTrail();
    assertReset(trail);
    trail.resetAllTo(10, 20, 30, 40, 0.85);
    assert.deepEqual(trail.vertices, [
      [10, 20],
      [30, 40],
      [10, 20],
      [30, 40],
    ]);
    assert.deepEqual(trail.alphas, [0.85, 0.85, 0.85, 0.85]);
    trail.mFollowingRibbonSegmentLine = ['new owner'];
    trail.mIsPlaying = true;
    pool.removeRibbonTrail(trail);
    assertReset(trail);
    pool.removeRibbonTrail(trail);
    assert.equal(pool.inactiveRibbonTrails.length, 1);
    assert.equal(pool.getRibbonTrail(), trail);
    assertReset(trail);
  } finally {
    dispose();
  }
});

test('native orphan reclamation retains its result and resets only reclaimed trails', () => {
  const { pool, dispose } = fixture();
  try {
    const orphan = pool.getRibbonTrail();
    orphan.mFollowingRibbonSegmentLine = ['orphan owner'];
    orphan.resetAllTo(99, 99, 99, 99);
    const alreadyInactive = new Trail();
    pool.inactiveRibbonTrails.push(alreadyInactive);
    assert.equal(pool.reclaimOrphans(), 1);
    assertReset(orphan);
    assert.equal(alreadyInactive.color, 0x123456);
    const unrelated = new Trail();
    pool.removeRibbonTrail(unrelated);
    assert.equal(unrelated.color, 0x123456);
  } finally {
    dispose();
  }
});

test('native pool rejection does not reset a trail still owned by the active list', () => {
  const { pool, dispose } = fixture();
  try {
    const trail = pool.getRibbonTrail();
    trail.mIsPlaying = true;
    trail.color = 0x123456;
    trail.poolIndex = -1;
    pool.removeRibbonTrail(trail);
    assert.deepEqual(pool.activeRibbonTrails, [trail]);
    assert.equal(pool.inactiveRibbonTrails.length, 0);
    assert.equal(trail.mIsPlaying, true);
    assert.equal(trail.color, 0x123456);
  } finally {
    dispose();
  }
});
