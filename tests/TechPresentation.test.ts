import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installTechPresentation } from '../src/tech/TechPresentation';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('tech presentation retains native updates and restores accessors on unload', () => {
  class Icon {
    tb = {};
    font = 'font13';
    size = 0;
    updates = 0;
    number = { get_format: () => ({
      set_font: (font: string) => { this.font = font; },
      set_size: (size: number) => { this.size = size; },
    }) };
    updateState(_state: string) { this.updates++; }
  }
  class Elite extends Icon { updateState(state: string) {
    this.updates++;
    if (state === 'locked') this.size = 16;
  } }
  class Popup {
    eliteTechs = [19.5, 30.75, 12].map(height => ({
      y: 0, get_height: () => height, set_y(y: number) { this.y = y; },
    }));
    load() {}
  }
  const classes: Record<string, unknown> = {
    'core.hud.components.techTree.TechLevelIcon': Icon,
    'core.hud.components.techTree.EliteTechIcon': Elite,
    'core.hud.components.techTree.EliteTechPopupMenu': Popup,
  };
  const hooks = new Hooks((error: unknown) => { throw error; });
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) => classes[name] ?? {},
    defer: (off: () => void) => cleanups.push(off),
    before: (owner: object, key: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(owner, key, 'before', callback);
      cleanups.push(off);
      return off;
    },
    after: (owner: object, key: string, callback: (...args: never[]) => unknown) => {
      const off = hooks.add(owner, key, 'after', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installTechPresentation(api);
  const icon = new Icon();
  try {
    icon.updateState('available');
    assert.equal(icon.size, 13);
    assert.equal(icon.font, 'verdana16_bitmap');
    assert.equal(icon.updates, 1);
    assert.equal(Reflect.get(icon, 'techBar'), icon.tb);
    assert.equal(Reflect.get(icon, 'get_techBar').call(icon), icon.tb);
    const elite = new Elite();
    elite.updateState('available');
    assert.equal(elite.size, 12);
    elite.updateState('locked');
    assert.equal(elite.size, 16, 'native state-specific sizes remain authoritative');
    const popup = new Popup();
    popup.load();
    assert.deepEqual(popup.eliteTechs.map(row => row.y), [0, 22, 55]);
  } finally {
    cleanups.reverse().forEach(off => off());
  }
  assert.equal(Object.hasOwn(Icon.prototype, 'techBar'), false);
  assert.equal(Object.hasOwn(Icon.prototype, 'get_techBar'), false);
});
