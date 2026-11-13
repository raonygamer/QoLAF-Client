import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installLandedFrameRate } from '../src/rendering/LandedFrameRate';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('landed screens preserve the chosen cap without blocking unrelated native frame changes', () => {
  let rate = 144;
  const stage = {
    set_frameRate(value: number) {
      return (rate = value);
    },
  };
  class Landed {
    enter() {
      stage.set_frameRate(30);
    }
    exit(complete: () => void) {
      stage.set_frameRate(60);
      complete();
    }
  }
  class Hangar extends Landed {
    enter() {
      super.enter();
      stage.set_frameRate(60);
    }
  }
  class Lore extends Landed {
    enter() {
      super.enter();
      stage.set_frameRate(60);
      throw new Error('load failed');
    }
  }
  const classes: Record<string, unknown> = {
    'core.states.gameStates.LandedState': Landed,
    'core.states.gameStates.LandedHangar': Hangar,
    'core.states.gameStates.LandedLore': Lore,
    'starling.core.Starling': { get_current: () => ({ get_nativeStage: () => stage }) },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: (owner: object, key: string, fn: unknown) => {
      const off = hooks.add(owner, key, 'around', fn);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installLandedFrameRate(api);
  const landed = new Landed();
  landed.enter();
  assert.equal(rate, 144);
  new Hangar().enter();
  assert.equal(rate, 144);
  let completed = 0;
  landed.exit(() => completed++);
  assert.equal(completed, 1);
  assert.equal(rate, 144);
  assert.throws(() => new Lore().enter(), /load failed/);
  stage.set_frameRate(60);
  assert.equal(rate, 60, 'the setter guard releases after failure');
  stage.set_frameRate(3);
  new Hangar().enter();
  assert.equal(rate, 3, 'an intentional lowerfps setting survives landed transitions too');
  landed.exit(() => stage.set_frameRate(1));
  assert.equal(rate, 1, 'unrelated idle limiting is not suppressed');
  cleanup.reverse().forEach((off) => off());
  landed.enter();
  assert.equal(rate, 30, 'native behavior returns after plugin cleanup');
});
