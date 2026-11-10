import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Display } from './Fixtures/NativeGame';
import { NativeUI } from '../src/UI/NativeUI';
import { NexarWorldLabel, installNexarWorldLabels } from '../src/Ship/NexarWorldLabel';
// @ts-expect-error actual host hooks
import { Hooks } from './Fixtures/HostCore.js';

function fixture() {
  class Quad extends Display {
    constructor(w: number, h: number, color: number) {
      super();
      this.set_width(w);
      this.set_height(h);
      this.values.color = color;
    }
    set_pivotX(v: number) {
      this.values.pivotX = v;
    }
    set_pivotY(v: number) {
      this.values.pivotY = v;
    }
    set_rotation(v: number) {
      this.values.rotation = v;
    }
  }
  class Format {
    constructor(
      public font: string,
      public size: number,
      public color: number,
    ) {}
  }
  class Text extends Display {
    writes = 0;
    constructor(
      w: number,
      h: number,
      public text: string,
      public format: Format,
    ) {
      super();
      this.set_width(w);
      this.set_height(h);
    }
    set_batchable(v: boolean) {
      this.values.batchable = v;
    }
    set_text(v: string) {
      this.text = v;
      this.writes++;
    }
  }
  const settings = {
    showNexarFactionLabels: true,
    showNexarEnemyNames: true,
    showNexarHealthBars: true,
    showNexarHealthValues: true,
  };
  const classes: any = {
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
    'starling.text.TextField': Text,
    'starling.text.TextFormat': Format,
    'core.scene.SceneBase': { clientSettings: settings },
  };
  const api: any = { cls: (name: string) => classes[name] },
    ui = new NativeUI(api);
  const game: any = { canvas: new Display(), canvasTexts: new Display() };
  const ship: any = {
    alive: true,
    isAddedToCanvas: true,
    owner: null,
    hp: 1000,
    hpMax: 2000,
    shieldHp: 250,
    shieldHpMax: 1000,
    collisionRadius: 30,
    movieClip: {
      x: 100,
      y: 200,
      visible: true,
      alpha: 0.6,
      pivotX: 20,
      pivotY: 10,
      scaleX: 2,
      scaleY: 1,
    },
  };
  return { api, ui, game, ship, classes, settings };
}

test('all original label option combinations use the source layout and live shield values', () => {
  const f = fixture(),
    before = JSON.stringify(f.ship);
  let now = 0;
  const label = new NexarWorldLabel(f.ui, 'Emperor Xhersix lvl 150', () => now);
  const [faction, name, shieldBackground, shieldFill, hpBackground, hpFill, shieldValue, hpValue] =
    label.node.children as any[];
  assert.equal(name.text, 'Emperor Xhersix');
  assert.equal(name.format.font, 'DAIDRR_16');
  assert.deepEqual([name.get_width(), name.get_height(), name.get_x()], [400, 22, -200]);
  assert.equal(faction.children[0].values.rotation, Math.PI / 4);
  assert.equal(faction.children[0].values.color, 0xf04b59);
  for (let flags = 0; flags < 16; flags++) {
    label.draw(f.game, f.ship, flags);
    if (!flags) {
      assert.equal(label.node.parent, null);
      continue;
    }
    assert.equal(label.node.parent, f.game.canvasTexts);
    assert.equal(faction.get_visible(), !!(flags & 1));
    assert.equal(name.get_visible(), !!(flags & 2));
    assert.equal(shieldBackground.get_visible(), !!(flags & 4));
    assert.equal(shieldFill.get_visible(), !!(flags & 4));
    assert.equal(hpBackground.get_visible(), !!(flags & 4));
    assert.equal(hpFill.get_visible(), !!(flags & 4));
    assert.equal(shieldValue.get_visible(), !!(flags & 8));
    assert.equal(hpValue.get_visible(), !!(flags & 8));
    let row = (flags & 1 ? 18 : 0) + (flags & 2 ? 22 : 0);
    if (flags & 12) {
      if (row) row += 2;
      row += (flags & 8 ? 16 : 5) * 2 + 2;
    }
    assert.equal(label.node.get_y(), 200 - 40 - row - 8);
  }
  assert.equal(shieldFill.get_width(), 36);
  assert.equal(hpFill.get_width(), 72);
  assert.equal(shieldValue.text, '250 / 1k');
  assert.equal(hpValue.text, '1k / 2k');
  assert.equal(label.node.get_alpha(), 0.6);
  assert.equal(JSON.stringify(f.ship), before, 'no native health/shield or transform mutation');
  const writes = shieldValue.writes;
  f.ship.shieldHp = 800;
  now = 99;
  label.draw(f.game, f.ship, 15);
  assert.equal(shieldValue.writes, writes);
  assert.equal(shieldFill.get_width(), 115.2);
  now = 100;
  label.draw(f.game, f.ship, 15);
  assert.equal(shieldValue.text, '800 / 1k');
  now = 200;
  label.draw(f.game, f.ship, 15);
  assert.equal(shieldValue.writes, writes + 1, 'unchanged values avoid text rebuild');
  f.ship.shieldHp = 0;
  label.draw(f.game, f.ship, 15);
  assert.equal(shieldFill.get_visible(), false);
  assert.equal(shieldFill.get_width(), 115.2, 'never zero the quad width');
  f.ship.shieldHp = 2000;
  label.draw(f.game, f.ship, 15);
  assert.equal(shieldFill.get_width(), 144);
  f.ship.shieldHpMax = 0;
  label.draw(f.game, f.ship, 15);
  assert.equal(shieldFill.get_visible(), false);
  f.game.canvas.set_scaleX(2);
  f.game.canvasTexts.set_scaleX(0.5);
  label.draw(f.game, f.ship, 3);
  assert.equal(label.node.get_scaleX(), 1);
  f.game.canvasTexts.set_scaleX(1);
  label.draw(f.game, f.ship, 3);
  assert.equal(label.node.get_scaleX(), 0.5);
  assert.equal(label.node.get_y(), 136);
  for (const key of ['alive', 'isAddedToCanvas']) {
    f.ship[key] = false;
    label.draw(f.game, f.ship, 3);
    assert.equal(label.node.parent, null);
    f.ship[key] = true;
  }
  f.ship.owner = {};
  label.draw(f.game, f.ship, 3);
  assert.equal(label.node.parent, null);
  f.ship.owner = null;
  f.ship.movieClip.alpha = 0;
  label.draw(f.game, f.ship, 3);
  assert.equal(label.node.parent, null);
  f.ship.movieClip.alpha = 1;
  f.game.canvas.set_scaleX(0);
  label.draw(f.game, f.ship, 3);
  assert.equal(label.node.parent, null);
  label.dispose();
  assert.equal(label.node.disposed, true);
});

test('native Nexar label hooks exclude ordinary elites, honor toggles and reset cached eligibility', () => {
  const f = fixture(),
    hooks = new Hooks(),
    cleanups: Function[] = [];
  class Enemy {
    g = f.game;
    alive = true;
    isAddedToCanvas = true;
    owner: any = null;
    name = 'Nexar Elite Blade';
    miniboss = true;
    isBossUnit = false;
    nexar = true;
    hp = 1000;
    hpMax = 2000;
    shieldHp = 250;
    shieldHpMax = 1000;
    collisionRadius = 30;
    movieClip = f.ship.movieClip;
    hasFaction(name: string) {
      assert.equal(name, 'Nexar');
      return this.nexar;
    }
    draw() {
      this.movieClip.x = 321;
      return 7;
    }
    removeFromCanvas() {
      this.isAddedToCanvas = false;
    }
    reset() {
      return 8;
    }
    destroy() {
      this.alive = false;
    }
  }
  f.classes['core.ship.EnemyShip'] = Enemy;
  Object.assign(f.api, {
    after: (t: any, k: string, fn: Function) => cleanups.push(hooks.add(t, k, 'after', fn)),
    before: (t: any, k: string, fn: Function) => cleanups.push(hooks.add(t, k, 'before', fn)),
    defer: (fn: Function) => cleanups.push(fn),
  });
  installNexarWorldLabels(f.api, f.game);
  const enemy = new Enemy();
  assert.equal(enemy.draw(), 7);
  assert.equal(f.game.canvasTexts.children.length, 0);
  enemy.name = 'Nexar Commander';
  enemy.draw();
  assert.equal(f.game.canvasTexts.children.length, 0, 'eligibility cached for one life');
  assert.equal(enemy.reset(), 8);
  enemy.draw();
  assert.equal(f.game.canvasTexts.children.length, 1);
  const label = f.game.canvasTexts.children[0];
  assert.equal(label.get_x(), 321);
  enemy.removeFromCanvas();
  assert.equal(label.parent, null);
  enemy.isAddedToCanvas = true;
  enemy.draw();
  assert.equal(label.parent, f.game.canvasTexts);
  for (const key of Object.keys(f.settings)) (f.settings as any)[key] = false;
  enemy.draw();
  assert.equal(label.parent, null);
  f.settings.showNexarEnemyNames = true;
  enemy.draw();
  assert.equal(f.game.canvasTexts.children[0], label, 'reuse existing label');
  enemy.destroy();
  assert.equal(label.disposed, true);
  assert.equal(f.game.canvasTexts.children.length, 0);
  enemy.alive = true;
  enemy.nexar = false;
  enemy.reset();
  enemy.draw();
  assert.equal(f.game.canvasTexts.children.length, 0);
  enemy.nexar = true;
  enemy.owner = {};
  enemy.reset();
  enemy.draw();
  assert.equal(f.game.canvasTexts.children.length, 0);
  enemy.owner = null;
  enemy.reset();
  enemy.draw();
  assert.equal(f.game.canvasTexts.children.length, 1);
  cleanups.reverse().forEach((fn) => fn());
  assert.equal(f.game.canvasTexts.children.length, 0);
  assert.equal(enemy.draw(), 7);
});
