import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installWeaponSelectorTooltips } from '../src/weapon/WeaponSelectorTooltips';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('weapon refresh disposes only owned tooltips before icons, including pre-install selectors', () => {
  class Icon {
    disposed = false;
  }
  class Tooltip {
    static toolTips: Tooltip[] = [];
    disposed = false;
    type = 'HomeState';
    constructor(public target: Icon) {
      Tooltip.toolTips.push(this);
    }
    dispose() {
      assert.equal(this.target.disposed, false, 'tooltip listeners detach before icon disposal');
      this.disposed = true;
      Tooltip.toolTips = Tooltip.toolTips.filter((tip) => tip !== this);
    }
  }
  class Selector {
    icons: Icon[] = [];
    addWeaponSelectIcon() {
      const icon = new Icon();
      this.icons.push(icon);
      new Tooltip(icon);
    }
    refresh() {
      for (const icon of this.icons) icon.disposed = true;
      this.icons = [];
      this.addWeaponSelectIcon();
    }
    dispose() {
      for (const icon of this.icons) icon.disposed = true;
      this.icons = [];
    }
  }
  const before = new Selector();
  before.addWeaponSelectIcon();
  const old = Tooltip.toolTips[0];
  const unrelated = new Tooltip(new Icon());
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const hook = (kind: string) => (owner: object, key: string, callback: Function) => {
    const off = hooks.add(owner, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const api = {
    cls: (name: string) =>
      name === 'core.hud.components.shipMenu.WeaponSelector'
        ? Selector
        : name === 'core.hud.components.ToolTip'
          ? Tooltip
          : {},
    before: hook('before'),
    after: hook('after'),
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installWeaponSelectorTooltips(api);
  try {
    before.refresh();
    assert.equal(old.disposed, true);
    assert.equal(unrelated.disposed, false);
    assert.equal(Tooltip.toolTips.length, 2);
    assert.equal(Tooltip.toolTips[1].type, 'WeaponSelector');
    for (let i = 0; i < 10; i++) before.refresh();
    assert.equal(Tooltip.toolTips.length, 2, 'refresh does not accumulate tooltip registrations');
    before.dispose();
    assert.deepEqual(Tooltip.toolTips, [unrelated]);
    const surviving = new Selector();
    surviving.addWeaponSelectIcon();
    assert.equal(Tooltip.toolTips[1].type, 'WeaponSelector');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(
    Tooltip.toolTips[1].type,
    'HomeState',
    'unload restores native ownership without removing live hover',
  );
  assert.equal(Tooltip.toolTips[1].disposed, false);
});
