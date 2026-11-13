import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWarpAnimation } from '../src/rendering/WarpAnimation';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture() {
  class Filter {
    disposals = 0;
    dispose() {
      this.disposals++;
    }
  }
  class Overlay {
    removals = 0;
    disposals = 0;
    removeFromParent(dispose = false) {
      this.removals++;
      if (dispose) this.disposals++;
    }
  }
  const originalFilter = new Filter();
  const clip = {
    filter: originalFilter,
    get_filter() {
      return this.filter;
    },
    set_filter(filter: Filter) {
      this.filter = filter;
    },
  };
  let speed = 0;
  const ship = { get_movieClip: () => clip, get_speed: () => ({ get_length: () => speed }) };
  class Scene {
    time = 100;
    leaving = false;
    camera = { trackStep: 7 };
    parallaxManager = {
      glows: 0,
      removals: 0,
      glow() {
        this.glows++;
      },
      removeGlow() {
        this.removals++;
      },
    };
    get_me() {
      return { ship };
    }
    get_isLeaving() {
      return this.leaving;
    }
    exit() {}
  }
  class Play {
    updates = 0;
    execute() {
      this.updates++;
    }
  }
  class Warp extends Play {
    g = new Scene();
    timeout = this.g.time + 10000;
    ship = ship;
    darkOverlay = new Overlay();
    flashOverlay = new Overlay();
    hyperDriveEngaged = false;
    jumps = 0;
    enter() {}
    execute() {
      throw Error('native animation must be replaced');
    }
    warpJump() {
      this.jumps++;
    }
    exit() {}
  }
  const tweens: Array<{ duration: number; onComplete: () => void }> = [];
  let kills = 0;
  const tween = {
    to(_target: object, duration: number, options: { onComplete: () => void }) {
      tweens.push({ duration, onComplete: options.onComplete });
    },
    killTweensOf() {
      kills++;
    },
  };
  const classes: Record<string, unknown> = {
    'core.scene.Game': Scene,
    'core.states.gameStates.WarpJumpState': Warp,
    'core.states.gameStates.PlayState': Play,
    'starling.filters.GlowFilter': Filter,
    'com.greensock.TweenMax': tween,
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around(target: object, name: string, callback: unknown) {
      const off = hooks.add(target, name, 'around', callback);
      cleanups.push(off);
      return off;
    },
    before(target: object, name: string, callback: unknown) {
      const off = hooks.add(target, name, 'before', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installWarpAnimation(api);
  return {
    state: new Warp(),
    clip,
    originalFilter,
    tweens,
    setSpeed: (value: number) => {
      speed = value;
    },
    kills: () => kills,
    dispose: () => cleanups.reverse().forEach((off) => off()),
  };
}

test('warp uses creation-anchored fallback and completes only once after the short fade', () => {
  const f = fixture();
  try {
    const s = f.state;
    s.g.time = 600;
    s.enter();
    assert.equal(s.timeout, 1100);
    assert.equal(s.flashOverlay.removals, 1);
    s.g.time = 1100;
    s.execute();
    assert.equal(f.tweens.length, 0);
    s.g.time++;
    s.execute();
    s.execute();
    assert.equal(f.tweens.length, 1);
    assert.equal(f.tweens[0].duration, 0.1);
    assert.equal(s.jumps, 0);
    assert.equal(s.g.camera.trackStep, 100);
    const glow = f.clip.filter;
    f.tweens[0].onComplete();
    f.tweens[0].onComplete();
    s.warpJump();
    assert.equal(s.jumps, 1);
    assert.equal(glow.disposals, 1);
    assert.equal(f.clip.filter, f.originalFilter);
    s.exit();
    s.exit();
    assert.equal(s.g.camera.trackStep, 7);
    assert.equal(f.kills(), 1);
    assert.equal(s.darkOverlay.disposals, 1);
  } finally {
    f.dispose();
  }
});

test('warp exit, room teardown and unload cancel late completion and preserve foreign filters', () => {
  for (const stop of ['exit', 'room', 'unload'] as const) {
    const f = fixture();
    let disposed = false;
    try {
      const s = f.state;
      s.enter();
      f.setSpeed(800);
      s.execute();
      const glow = f.clip.filter;
      const foreign = {
        disposals: 0,
        dispose() {
          this.disposals++;
        },
      };
      f.clip.filter = foreign;
      if (stop === 'exit') s.exit();
      else if (stop === 'room') s.g.exit();
      else {
        f.dispose();
        disposed = true;
      }
      f.tweens[0].onComplete();
      assert.equal(s.jumps, 0);
      assert.equal(s.g.camera.trackStep, 7);
      assert.equal(s.g.parallaxManager.removals, 1);
      assert.equal(glow.disposals, 1);
      assert.equal(f.clip.filter, foreign);
      assert.equal(foreign.disposals, 0);
    } finally {
      if (!disposed) f.dispose();
    }
  }
});
