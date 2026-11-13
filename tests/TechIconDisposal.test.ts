import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installTechIconDisposal } from '../src/tech/TechIconDisposal';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('tech icon disposal releases only owned tooltips and cancels elite tweens before children', () => {
  const killed: object[] = [];
  class LevelIcon {
    disposals = 0;
    dispose() { this.disposals++; }
  }
  class EliteIcon {
    number: object | null = {};
    icon: object | null = {};
    disposals = 0;
    dispose() {
      if (this.number) assert.ok(killed.includes(this.number));
      if (this.icon) assert.ok(killed.includes(this.icon));
      assert.equal(Tooltip.toolTips.some((tip) => tip.target === this), false);
      this.disposals++;
    }
  }
  class Tooltip {
    static toolTips: Tooltip[] = [];
    disposals = 0;
    constructor(public target: object | null) { Tooltip.toolTips.push(this); }
    dispose() {
      this.disposals++;
      this.target = null;
      Tooltip.toolTips.splice(Tooltip.toolTips.indexOf(this), 1);
    }
  }
  const classes: Record<string, unknown> = {
    'core.hud.components.techTree.TechLevelIcon': LevelIcon,
    'core.hud.components.techTree.EliteTechIcon': EliteIcon,
    'core.hud.components.ToolTip': Tooltip,
    'com.greensock.TweenMax': { killTweensOf: (target: object) => killed.push(target) },
  };
  const hooks = new Hooks((error: unknown) => { throw error; });
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) => classes[name] ?? {},
    before: (owner: object, key: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(owner, key, 'before', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installTechIconDisposal(api);
  try {
    const elite = new EliteIcon();
    const level = new LevelIcon();
    const first = new Tooltip(elite);
    const unrelated = new Tooltip({});
    const second = new Tooltip(elite);
    const levelTip = new Tooltip(level);
    elite.dispose();
    assert.deepEqual(killed, [elite.number, elite.icon]);
    assert.deepEqual(Tooltip.toolTips, [unrelated, levelTip]);
    assert.equal(first.disposals, 1);
    assert.equal(second.disposals, 1);
    level.dispose();
    assert.equal(levelTip.disposals, 1);
    assert.deepEqual(Tooltip.toolTips, [unrelated]);
    assert.equal(unrelated.disposals, 0);
    const partial = new EliteIcon();
    partial.number = partial.icon = null;
    partial.dispose();
    assert.equal(partial.disposals, 1);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  const restored = new LevelIcon();
  const retained = new Tooltip(restored);
  restored.dispose();
  assert.equal(retained.disposals, 0, 'unload restores native ownership');
});
