import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installKillOnSightLabels } from '../src/ship/KillOnSightLabels';
import { Display, Text } from './fixtures/NativeGame';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('original KoS assignments, centering, hide and reuse lifecycle', () => {
  class Label extends Text {
    constructor(_x = 0, _y = 0, text = '') {
      super(0, 0, text);
    }
    autoWidth() {
      this.set_width(this.text.length * 7);
    }
  }
  class Ship {
    player = { id: 'ordinary' };
    nameText = new Label();
    levelText = new Label();
    supporterIcon = new Display();
    landed = false;
    get_landed() {
      return this.landed;
    }
    draw() {
      this.nameText.set_x(100 - this.nameText.get_width() / 2);
      this.nameText.set_y(50);
      this.levelText.set_x(this.nameText.get_x() + this.nameText.get_width());
      this.supporterIcon.set_x(this.nameText.get_x() - 15);
    }
    hideStats() {
      this.nameText.set_visible(false);
    }
    removeFromCanvas() {
      this.nameText.removeFromParent();
    }
    reset() {}
    destroy() {}
  }
  const hooks = new Hooks();
  const cleanups: (() => void)[] = [];
  const api = {
    cls: (name: string) =>
      name.endsWith('PlayerShip')
        ? Ship
        : name.endsWith('TextBitmap')
          ? Label
          : { COLOR_HOSTILE: 0xff0000 },
    after: (target: object, key: string, fn: (...args: never[]) => unknown) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    before: (target: object, key: string, fn: (...args: never[]) => unknown) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    defer: (fn: () => void) => cleanups.push(fn),
  } as unknown as API;
  bindGameClasses(api);
  installKillOnSightLabels(api);
  const ship = new Ship();
  const canvas = new Display();
  ship.nameText.set_width(70);
  ship.levelText.set_width(21);
  canvas.addChild(ship.nameText);
  canvas.addChild(ship.levelText);
  try {
    ship.draw();
    assert.equal(canvas.children.length, 2);
    assert.equal(ship.nameText.get_x(), 65);
    for (const id of ['simple1785239895147', 'steam76561199793920727', 'steam76561199175782109']) {
      ship.player.id = id;
      ship.draw();
      const label = canvas.children[2] as Label;
      const soft = id === 'steam76561199175782109';
      assert.equal(label.text, soft ? ' (Soft KoS)' : ' (KoS)');
      assert.equal(label.format.get_color(), soft ? 0x48cfff : 0xff0000);
      assert.equal((ship.nameText.get_x() + label.get_x() + label.get_width()) / 2, 100);
      assert.equal(label.get_y(), 50);
      ship.draw();
      assert.equal((ship.nameText.get_x() + label.get_x() + label.get_width()) / 2, 100);
      ship.hideStats();
      assert.equal(label.get_visible(), false);
      ship.reset();
      assert.equal(label.disposed, true);
      assert.equal(canvas.children.length, 2);
      ship.nameText.set_visible(true);
    }
    ship.draw();
    ship.removeFromCanvas();
    assert.equal(canvas.children.length, 1);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});
