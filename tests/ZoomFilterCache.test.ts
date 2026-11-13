import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZoomFilterCache } from '../src/rendering/ZoomFilterCache';

test('zoomed-out cached filters regain full resolution after zooming back in', () => {
  const cache = new ZoomFilterCache();
  let cached = true,
    rebuilds = 0;
  const filter = {
    get_isCached: () => cached,
    cache: () => {
      rebuilds++;
    },
  };
  cache.refresh(filter, 1);
  assert.equal(rebuilds, 1);
  cache.refresh(filter, 1);
  assert.equal(rebuilds, 1);
  cache.refresh(filter, 0.25);
  assert.equal(rebuilds, 2);
  cache.refresh(filter, 1);
  assert.equal(rebuilds, 3);
  cache.refresh(filter, 1);
  assert.equal(rebuilds, 3);
  cached = false;
  cache.refresh(filter, 0.5);
  assert.equal(rebuilds, 3);
  cached = true;
  cache.refresh(filter, 0.5);
  assert.equal(rebuilds, 4);
  cache.refresh(filter, NaN);
  cache.refresh(filter, 0);
  assert.equal(rebuilds, 4);
});

test('native render hook follows eased canvas scale while the requested zoom stays fixed', async () => {
  const { installZoomFilterCache } = await import('../src/rendering/ZoomFilterCache');
  const { bindGameClasses } = await import('../src/game/Bindings');
  // @ts-expect-error actual host dispatcher
  const { Hooks } = await import('./fixtures/HostCore.js');
  let canvasScale = 0.25;
  const rasterScales: number[] = [];
  const target = {};
  class Filter {
    _target = target;
    get_isCached() {
      return true;
    }
    cache() {
      rasterScales.push(canvasScale);
    }
    render() {}
  }
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const game = {
    canvas: { contains: (object: object) => object === target },
    camera: {
      get_zoomFactor: () => 1,
      _stageContainer: { get_scaleX: () => canvasScale },
    },
  } as unknown as import('../src/game/Bindings').GameScene;
  const api = {
    cls: (name: string) => (name === 'starling.filters.FragmentFilter' ? Filter : {}),
    before: (owner: object, method: string, callback: Function) => {
      const remove = hooks.add(owner, method, 'before', callback);
      cleanups.push(remove);
      return remove;
    },
  } as unknown as import('../src/api/Types').API;
  bindGameClasses(api);
  installZoomFilterCache(api, game);
  try {
    const filter = new Filter();
    for (const scale of [0.25, 0.5, 0.75, 1]) {
      canvasScale = scale;
      filter.render();
    }
    assert.deepEqual(rasterScales, [0.25, 0.5, 0.75, 1]);
    filter.render();
    assert.equal(rasterScales.length, 4, 'settled scale does not rebuild on every frame');
    filter._target = {};
    canvasScale = 0.5;
    filter.render();
    assert.equal(rasterScales.length, 4, 'unrelated UI filters retain native caching');
  } finally {
    cleanups.reverse().forEach((remove) => remove());
  }
});
