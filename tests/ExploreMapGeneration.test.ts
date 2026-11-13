import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installExploreMapGeneration } from '../src/explore/MapGeneration';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('exploration generates one seed per frame, publishes cache once, and cancels on exit/disposal', () => {
  type Area = { key: string; size: number };
  type Body = { generatedAreas: Area[] | null; generatedShells: number[][] | null };
  class Sprite {
    listeners = new Map<string, () => void>();
    children: object[] = [];
    addEventListener(name: string, fn: () => void) {
      this.listeners.set(name, fn);
    }
    removeEventListener(name: string, fn: () => void) {
      if (this.listeners.get(name) === fn) this.listeners.delete(name);
    }
    dispatchEventWith(name: string) {
      this.listeners.get(name)?.();
    }
    addChild(child: object) {
      this.children.push(child);
    }
    set_x(_x: number) {}
    set_y(_y: number) {}
    dispose() {}
  }
  class Label extends Sprite {
    removed = false;
    constructor(..._args: unknown[]) {
      super();
    }
    center() {}
    removeFromParent(_dispose: boolean) {
      this.removed = true;
    }
  }
  class Box extends Sprite {
    constructor(..._args: unknown[]) {
      super();
    }
  }
  class Random {
    constructor(public seed: number) {}
  }
  class MapView extends Sprite {
    done = false;
    seed = 0.9;
    r = new Random(0);
    areas: Area[] = [];
    shell: number[][] = [];
    attempts = 0;
    draws = 0;
    constructor(_game: object, _areas: Area[], body: Body) {
      super();
      if (!body.generatedAreas || !body.generatedShells) {
        this.generateMap();
        body.generatedAreas = this.areas;
        body.generatedShells = this.shell;
      } else {
        this.areas = body.generatedAreas;
        this.shell = body.generatedShells;
      }
      this.drawMap();
    }
    generateMap() {
      throw new Error('blocking native generator');
    }
    tryGenerateMap() {
      this.attempts++;
      this.areas = [{ key: 'done', size: 1 }];
      this.shell = [[1]];
      return this.attempts === 2;
    }
    drawMap() {
      this.draws++;
    }
  }
  class State {
    g = {};
    bodyAreas: Area[] = [];
    areas: object[] | null = null;
    b: Body = { generatedAreas: null, generatedShells: null };
    container: object | null = {};
    areaBox = new Sprite();
    exploreMap: MapView | null = null;
    finished = 0;
    addChild(_child: object) {}
    addExploreAreas(_map: MapView) {
      this.finished++;
    }
    addImg(_box: Box) {}
    createMap() {}
    execute() {}
    stopEffect() {}
    exit() {
      this.container = null;
    }
  }
  const classes: Record<string, unknown> = {
    'core.states.exploreStates.ExploreState': State,
    'core.hud.components.explore.ExploreMap': MapView,
    'starling.display.Sprite': Sprite,
    'core.hud.components.TextBitmap': Label,
    'core.hud.components.Box': Box,
    'generics.Random': Random,
    'generics.Localize': { t: (s: string) => s },
  };
  const hooks = new Hooks(),
    cleanup: Array<() => void> = [];
  const api = {
    cls: (name: string) => classes[name] ?? {},
    log() {},
    ...Object.fromEntries(
      ['around', 'before'].map((kind) => [
        kind,
        (owner: object, name: string, callback: unknown) => {
          const off = hooks.add(owner, name, kind, callback);
          cleanup.push(off);
          return off;
        },
      ]),
    ),
    defer: (off: () => void) => cleanup.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installExploreMapGeneration(api);
  const state = new State();
  try {
    state.createMap();
    const map = state.exploreMap!;
    assert.equal(state.b.generatedAreas, null);
    assert.equal(state.b.generatedShells, null);
    assert.equal(map.draws, 0);
    assert.equal(state.finished, 0);
    assert.deepEqual(state.areas, []);
    map.dispatchEventWith('enterFrame');
    assert.equal(map.attempts, 0);
    map.dispatchEventWith('enterFrame');
    assert.equal(map.attempts, 1);
    assert.equal(map.seed, (0.9 + 0.12341) / 2);
    map.dispatchEventWith('enterFrame');
    assert.equal(map.attempts, 2);
    assert.equal(map.draws, 1);
    assert.equal(state.finished, 1);
    assert.equal(state.b.generatedAreas, map.areas);
    assert.equal(state.b.generatedShells, map.shell);
    assert.equal(map.listeners.has('enterFrame'), false);
    assert.equal((map.children[0] as Label).removed, true);
    const cached = new State();
    cached.b = state.b;
    cached.createMap();
    assert.equal(cached.exploreMap!.attempts, 0);
    assert.equal(cached.finished, 1);
    for (const mode of ['exit', 'dispose']) {
      const stopped = new State();
      stopped.createMap();
      const pending = stopped.exploreMap!;
      if (mode === 'exit') stopped.exit();
      else pending.dispose();
      pending.dispatchEventWith('enterFrame');
      pending.dispatchEventWith('enterFrame');
      assert.equal(pending.attempts, 0);
      assert.equal(stopped.finished, 0);
    }
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
});
