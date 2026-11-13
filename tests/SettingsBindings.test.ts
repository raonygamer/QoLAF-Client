import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { createSettingsBindings } from '../src/ported/SettingsBindings';
import { aliasProperties } from '../src/runtime/HaxeInterop';
import { Display } from './fixtures/NativeGame';

test('binding page preserves source row order and releases its stage update listener', (t) => {
  const cleanups: Array<() => void> = [];
  aliasProperties(
    { defer: (cleanup: () => void) => cleanups.push(cleanup) } as unknown as API,
    Display,
  );
  t.after(() => cleanups.reverse().forEach((cleanup) => cleanup()));
  const stage = new Display();
  const keybinds = {};
  const rows: Row[] = [];
  class Row extends Display {
    updates = 0;
    constructor(
      readonly keys: object,
      readonly id: number,
      x: number,
      y: number,
    ) {
      super();
      this.set_x(x);
      this.set_y(y);
      rows.push(this);
    }
    update() {
      this.updates++;
    }
  }
  class Label extends Display {
    htmlText = '';
    size = 0;
  }
  class Button extends Display {
    constructor(
      readonly callback: () => void,
      readonly text: string,
    ) {
      super();
    }
  }
  const definitions: Record<string, unknown> = {
    'core.hud.components.Button': Button,
    'core.hud.components.SettingsKeybind': Row,
    'core.hud.components.Text': Label,
    'core.scene.SceneBase': { settings: { keybinds } },
    'feathers.controls.ScrollContainer': Display,
    'generics.Localize': { t: (text: string) => text },
    'starling.display.Sprite': Display,
  };
  const Page = createSettingsBindings((name) => definitions[name]);
  const page = new Page({ stage });
  assert.deepEqual(
    rows.map((row) => row.id),
    [
      11, 26, 12, 13, 14, 27, 28, 16, 15, 18, 17, 19, 20, 21, 22, 23, 24, 10, 9, 2, 1, 3, 7, 25, 6,
      4, 5, 8, 0,
    ],
  );
  assert.equal((page.getChildAt(1) as Button).text, 'Keyboard / Mouse');
  assert.equal((page.getChildAt(2) as Button).text, 'Controller');
  const scroll = page.getChildAt(0) as Display;
  assert.deepEqual(
    [scroll.get_x(), scroll.get_y(), scroll.get_width(), scroll.get_height()],
    [8, 85, 730, 460],
  );
  assert.deepEqual(
    scroll.children
      .filter((child): child is Label => child instanceof Label)
      .map((label) => label.htmlText),
    ['Movements:', 'Abilities:', 'Weapons', 'Misc:'],
  );
  assert.ok(rows.every((row) => row.keys === keybinds && row.get_x() === 20));
  assert.equal(rows[0].get_y(), 40);
  assert.equal(rows[1].get_y(), 102);
  assert.equal(stage.listeners('updateButtons').length, 1);
  stage.dispatchEventWith('updateButtons');
  assert.ok(rows.every((row) => row.updates === 1));
  page.dispose();
  assert.equal(stage.listeners('updateButtons').length, 0);
  stage.dispatchEventWith('updateButtons');
  assert.ok(rows.every((row) => row.updates === 1));
  const second = new Page({ stage });
  assert.equal(
    stage.listeners('updateButtons').length,
    1,
    'reopening does not accumulate listeners',
  );
  second.dispose();
  assert.equal(stage.listeners('updateButtons').length, 0);
});
