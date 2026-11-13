import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installExplorationPresentation } from '../src/explore/Presentation';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('exploration fonts are scoped by native screen and size, and restore on unload', () => {
  class Format {
    font = 'font13';
    constructor(public size: number) {}
    get_size() {
      return this.size;
    }
    set_size(value: number) {
      this.size = value;
    }
    get_font() {
      return this.font;
    }
    set_font(value: string) {
      this.font = value;
    }
  }
  class Text {
    format: Format;
    pivots = 0;
    constructor(size: number) {
      this.format = new Format(size);
    }
    get_format() {
      return this.format;
    }
    alignPivot() {
      this.pivots++;
    }
  }
  class Container {
    children: Text[] = [];
    get_numChildren() {
      return this.children.length;
    }
    getChildAt(index: number) {
      return this.children[index];
    }
  }
  class Crew {
    addLocation(_box: Container, _selectable: boolean) {}
  }
  class Area extends Container {
    handleFinished() {
      this.children.push(new Text(20));
    }
  }
  const hooks = new Hooks(),
    cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) =>
      name === 'core.hud.components.CrewDisplayBox'
        ? Crew
        : name === 'core.hud.components.explore.ExploreArea'
          ? Area
          : name === 'starling.text.TextField'
            ? Text
            : {},
    after(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'after', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installExplorationPresentation(api);
  const box = new Container(),
    area = new Area();
  box.children = [new Text(14), new Text(20), new Text(14)];
  box.children[2].format.font = 'custom';
  try {
    new Crew().addLocation(box, true);
    area.handleFinished();
    assert.equal(box.children[0].format.font, 'DAIDRR_16');
    assert.equal(box.children[1].format.font, 'font13');
    assert.equal(box.children[2].format.font, 'custom');
    assert.equal(area.children[0].format.font, 'DAIDRR_24');
    area.children[0].format.font = 'other-plugin';
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(box.children[0].format.font, 'font13');
  assert.equal(area.children[0].format.font, 'other-plugin');
});
