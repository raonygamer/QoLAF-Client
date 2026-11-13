import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installParallaxLoading } from '../src/rendering/ParallaxLoading';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('ship selection releases owned parallax displays once before native screen disposal', () => {
  class Display {
    attached = true;
    disposals = 0;
    removeFromParent() { this.attached = false; }
    dispose() {
      assert.equal(this.attached, false);
      this.disposals++;
    }
  }
  class Parallax {
    nebulaContainer = new Display();
    starBatch = new Display();
    starTxt: object | null = {};
    nebulaTxt: object | null = {};
    g: object | null = {};
    clears = 0;
    load() {}
    refresh() {}
    clear() { this.clears++; }
  }
  class Setup {
    pm: Parallax | null = new Parallax();
    isRunning = true;
    disposals = 0;
    dispose() {
      assert.equal(this.pm, null);
      assert.equal(this.isRunning, false);
      this.disposals++;
    }
  }
  class Scene { exit() {} dispose() {} fadeIntoState() {} }
  class Textures { disposeCustomTextures() {} }
  const classes: Record<string, unknown> = {
    'core.parallax.ParallaxManager': Parallax,
    'startSetup.StartSetup': Setup,
    'core.scene.Game': Scene,
    'textures.TextureManager': Textures,
  };
  const hooks = new Hooks((error: unknown) => { throw error; });
  const cleanups: (() => void)[] = [];
  const hook = (kind: string) => (owner: object, key: string, callback: (...args: never[]) => unknown) => {
    const off = hooks.add(owner, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: hook('around'), before: hook('before'),
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installParallaxLoading(api);
  try {
    const setup = new Setup();
    const manager = setup.pm!;
    const texture = manager.starTxt;
    setup.dispose();
    setup.dispose();
    assert.equal(manager.clears, 1);
    assert.equal(manager.nebulaContainer.disposals, 1);
    assert.equal(manager.starBatch.disposals, 1);
    assert.equal(manager.starTxt, null);
    assert.equal(manager.nebulaTxt, null);
    assert.equal(manager.g, null);
    assert.deepEqual(texture, {}, 'shared atlas textures are not disposed');
    manager.refresh();
    const partial = new Setup();
    partial.pm = null;
    partial.dispose();
  } finally { cleanups.reverse().forEach(off => off()); }
});
