import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installTechBarDisposal } from '../src/tech/TechBarDisposal';
// @ts-expect-error upstream JavaScript fixture
import { nativeContainerDispose, nativeTechBarDispose } from './fixtures/NativeTechBar.js';
// @ts-expect-error real host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('tech icons are disposed once through their container, including partial construction', () => {
  class Icon {
    disposals = 0;
    dispose() {
      this.disposals++;
    }
  }
  class Base {
    disposals = 0;
    dispose() {
      this.disposals++;
    }
  }
  class Container extends Base {
    children: Icon[] = [];
    __children = {
      get_length: () => this.children.length,
      get: (index: number) => this.children[index],
    };
  }
  Container.prototype.dispose = nativeContainerDispose(Base);
  class Bar extends Container {
    techIcons: Icon[] | null = [new Icon(), new Icon()];
    eliteTechIcon: Icon | null = new Icon();
    eti = this.eliteTechIcon;
    listeners = true;
    constructor() {
      super();
      this.children = [...this.techIcons!, this.eliteTechIcon!];
    }
    removeEventListeners() {
      this.listeners = false;
    }
  }
  Bar.prototype.dispose = nativeTechBarDispose(Container);
  const vanilla = new Bar();
  vanilla.dispose();
  assert.deepEqual(
    vanilla.children.map((icon) => icon.disposals),
    [2, 2, 1],
  );
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) => (name.endsWith('.TechBar') ? Bar : Container),
    around: (target: object, key: string, fn: (...args: never[]) => unknown) => {
      const remove = hooks.add(target, key, 'around', fn);
      cleanups.push(remove);
      return remove;
    },
  } as unknown as API;
  bindGameClasses(api);
  installTechBarDisposal(api);
  try {
    for (const partial of [false, true]) {
      const bar = new Bar();
      if (partial) {
        bar.techIcons = null;
        bar.eliteTechIcon = bar.eti = null;
      }
      bar.dispose();
      bar.dispose();
      assert.deepEqual(
        bar.children.map((icon) => icon.disposals),
        [1, 1, 1],
      );
      assert.equal(bar.disposals, 1);
      assert.equal(bar.listeners, false);
      assert.equal(bar.techIcons, null);
      assert.equal(bar.eliteTechIcon, null);
      assert.equal(bar.eti, null);
    }
  } finally {
    cleanups.reverse().forEach((remove) => remove());
  }
  const restored = new Bar();
  restored.dispose();
  assert.deepEqual(
    restored.children.map((icon) => icon.disposals),
    [2, 2, 1],
  );
});
