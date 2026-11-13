import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene } from '../src/game/Bindings';
import { installPlayerListRoles } from '../src/hud/PlayerListRoles';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('player-list roles preserve staff precedence, animate mesh tint and restore native rows', () => {
  const game = {} as GameScene;
  class Label extends Display {
    color = 0;
    constructor(
      x: number,
      y: number,
      public text: string,
      public size = 13,
    ) {
      super();
      this.set_x(x);
      this.set_y(y);
    }
    get_size() {
      return this.size;
    }
    get_textBounds() {
      return { width: this.text.length * 7 };
    }
    get_style() {
      return { set_color: (color: number) => (this.color = color) };
    }
  }
  class Row extends Display {
    rebuild = true;
    g = game;
    player = { id: 'steam76561199032900322', isDeveloper: false, isModerator: false };
    constructor() {
      super();
      // Haxe builds the labels before the constructor's final update call.
      this.addChild(new Label(280, 26, 'lvl 150'));
      this.rebuild = false;
      this.update();
    }
    update() {
      if (!this.rebuild) return;
      this.removeChildren(0, -1, true);
      this.addChild(new Label(280, 26, 'lvl 150'));
    }
  }
  let color = 0x123456;
  const cleanups: Array<() => void> = [];
  const frames: Array<(event: { game: GameScene }) => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const classes: Record<string, unknown> = {
    'core.hud.components.playerList.PlayerListItem': Row,
    'core.hud.components.TextBitmap': Label,
    'core.hud.components.Style': { COLOR_HOSTILE: 0xff0000 },
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    defer: (off: () => void) => cleanups.push(off),
    on: (_name: string, fn: (event: { game: GameScene }) => void) => frames.push(fn),
    ...Object.fromEntries(
      ['before', 'after'].map((kind) => [
        kind,
        (owner: object, name: string, callback: unknown) => {
          const off = hooks.add(owner, name, kind, callback);
          cleanups.push(off);
          return off;
        },
      ]),
    ),
  } as unknown as API;
  bindGameClasses(api);
  installPlayerListRoles(api, game, (name) =>
    name.endsWith('ChatRoleTags')
      ? { forPlayer: () => ({ label: 'custom', color: 0xabcdef }) }
      : {
          get currentColor() {
            return color;
          },
        },
  );
  const row = new Row();
  try {
    assert.equal(row.children.length, 3, 'constructor update installs roles before first display');
    const labels = row.children as Label[];
    assert.deepEqual(
      labels.map((label) => label.text),
      ['lvl 150', 'client dev', 'custom'],
    );
    assert.equal(labels[1].get_x(), 280);
    assert.equal(labels[2].get_x(), 356);
    assert.equal(labels[0].get_x(), 404);
    const animated = labels[1];
    color = 0x654321;
    frames.forEach((frame) => frame({ game }));
    assert.equal(animated.color, color);
    assert.equal(labels[2].color, 0xabcdef);
    row.rebuild = false;
    row.update();
    assert.equal(row.children[1], animated, 'native button-only updates reuse composed labels');
    row.rebuild = true;
    row.update();
    assert.equal(row.children.length, 3);
    assert.equal(animated.disposed, true);
    for (const staff of ['isDeveloper', 'isModerator'] as const) {
      row.player[staff] = true;
      row.update();
      assert.deepEqual(
        (row.children as Label[]).map((label) => label.text),
        ['lvl 150', 'custom'],
      );
      row.player[staff] = false;
    }
    row.update();
    for (const [id, text, tint] of [
      ['simple1785239895147', '(KoS)', 0xff0000],
      ['steam76561199793920727', '(KoS)', 0xff0000],
      ['steam76561199175782109', '(Soft KoS)', 0x48cfff],
    ] as const) {
      row.player.id = id;
      row.update();
      const marker = (row.children as Label[]).find((label) => label.text === text);
      assert.ok(marker);
      assert.equal(marker.color, tint);
      row.rebuild = false;
      row.update();
      assert.equal((row.children as Label[]).filter((label) => label.text === text).length, 1);
      row.rebuild = true;
    }
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(row.children.length, 1);
  assert.equal(row.children[0].get_x(), 280);
  row.update();
  assert.equal(row.children.length, 1);
});
