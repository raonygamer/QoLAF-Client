import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { GameScene } from '../src/game/Bindings';
import { bindGameClasses } from '../src/game/Bindings';
import { installRadarMiniatures } from '../src/radar/RadarMiniatures';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('disposed native radar cannot recreate miniature layers or process stale contacts', () => {
  const masks: Mask[] = [];
  class Sprite extends Display {
    set_mask(_mask: Display | null) {}
  }
  class Mask extends Display {
    static fromPolygon() {
      const mask = new Mask();
      masks.push(mask);
      return mask;
    }
  }
  class Blip {
    disposed = false;
    constructor(readonly go: { get_lifecycleId(): number }) {}
    updateVisibility() {
      return true;
    }
    dispose() {
      this.disposed = true;
    }
  }
  const game = { hud: { radar: null as Radar | null }, get_me: () => null };
  class Radar extends Sprite {
    g = game;
    blips: Blip[] | null = [];
    createBlip(blip: Blip) {
      this.blips?.push(blip);
    }
    update() {}
    load() {}
    dispose() {
      this.blips = null;
    }
  }
  const cleanups: Array<() => void> = [];
  const frames: Array<(event: { game: GameScene }) => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook =
    (kind: string) => (owner: object, method: string, callback: (...args: never[]) => unknown) => {
      const remove = hooks.add(owner, method, kind, callback);
      cleanups.push(remove);
      return remove;
    };
  const registry: Record<string, object> = {
    'core.hud.components.radar.Radar': Radar,
    'core.hud.components.radar.Blip': Blip,
    'starling.display.Sprite': Sprite,
    'starling.display.Mesh': Mask,
    'starling.geom.Polygon': { createCircle: () => ({}) },
  };
  const api = {
    cls: (name: string) => registry[name] ?? class {},
    before: hook('before'),
    after: hook('after'),
    around: hook('around'),
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    on: (_event: string, callback: (event: { game: GameScene }) => void) => frames.push(callback),
  } as unknown as API;
  bindGameClasses(api);
  const scene = game as unknown as GameScene;
  installRadarMiniatures(api, scene);
  const radar = (game.hud.radar = new Radar());
  const frame = () => frames.forEach((callback) => callback({ game: scene }));
  try {
    let generation = 0;
    const blip = new Blip({ get_lifecycleId: () => generation });
    radar.createBlip(blip);
    frame();
    assert.equal(radar.children.length, 1);
    generation++;
    radar.update();
    assert.equal(blip.disposed, true);
    assert.deepEqual(radar.blips, []);
    radar.dispose();
    assert.equal(radar.children.length, 0);
    assert.equal(masks[0].disposed, true);
    frame(); // HUD may still reference the disposed radar until teardown completes.
    assert.equal(masks.length, 1);
    assert.equal(radar.children.length, 0);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});
