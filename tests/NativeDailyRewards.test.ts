import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error actual host hook implementation
import { Hooks } from './fixtures/HostCore.js';
import { installNativeDailyRewards } from '../src/ui/NativeDailyRewards';

test('daily reward source layout centers native pairs, spaces all five days, and survives redraw', () => {
  class Node {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    children: Node[] = [];
    padding = 0;
    get_x() {
      return this.x;
    }
    get_y() {
      return this.y;
    }
    get_width() {
      return this.width;
    }
    get_height() {
      return this.height;
    }
    get_padding() {
      return this.padding;
    }
    set_x(value: number) {
      this.x = value;
    }
    set_width(value: number) {
      this.width = value;
    }
    set_y(value: number) {
      this.y = value;
    }
    get_numChildren() {
      return this.children.length;
    }
    getChildAt(index: number) {
      return this.children[index];
    }
    addChild(child: Node) {
      this.children.push(child);
      return child;
    }
  }
  class Label extends Node {
    format = {};
    get_text() {
      return this.text;
    }
    wrap = true;
    constructor(public text: string) {
      super();
      this.width = 100;
    }
    set_wordWrap(value: boolean) {
      this.wrap = value;
    }
    set_defaultTextFormat() {
      this.width = this.text.length * 8;
    }
  }
  class Image extends Node {
    constructor() {
      super();
      this.width = 24;
    }
  }
  class Card extends Node {
    static boxWidth = 90;
    textField: Label;
    textField2?: Label;
    image?: Image;
    dayTextField: Label;
    constructor(day: number, flux: number, pods: number) {
      super();
      this.width = 110;
      this.height = 106;
      this.textField = new Label(flux ? String(flux) : '');
      this.dayTextField = new Label('Day ' + day);
      this.addChild(this.textField);
      this.addChild(this.dayTextField);
      if (flux) this.addChild(new Image());
      if (pods) {
        this.textField2 = new Label(String(pods));
        this.image = new Image();
        this.addChild(this.textField2);
        this.addChild(this.image);
      }
    }
  }
  const stage = { get_stageWidth: () => 1280, get_stageHeight: () => 800 };
  class Daily extends Node {
    g = { get_stage: () => stage };
    box = Object.assign(new Node(), { width: 150, height: 180, y: 300, padding: 10 });
    boxXPos = 0;
    dayTextField?: Label;
    callback = () => 'native reward callback';
    redraws = 0;
    constructor(public combo: number) {
      super();
      this.redraw(); // Native base constructor calls the override early.
      this.box.width = 150; // Daily constructor then narrows the highlighted card.
      for (let day = 1; day <= 5; day++) {
        if (day !== combo)
          this.addChild(new Card(day, [4, 8, 12, 0, 16][day - 1], day >= 4 ? 1 : 0));
      }
      this.dayTextField = new Label('TODAY');
      this.addChild(this.dayTextField);
    }
    redraw() {
      this.redraws++;
      this.box.width = 200;
      this.box.x = this.boxXPos;
    }
  }
  const cleanups: Function[] = [];
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const classes: any = {
    'core.hud.components.dialogs.DailyRewardMessage': Daily,
    'core.hud.components.dialogs.DailyRewardChild': Card,
    'starling.display.Image': Image,
  };
  const api = {
    cls: (name: string) => classes[name],
    after: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
  } as unknown as API;
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? {} });
  installNativeDailyRewards(api);
  try {
    for (let combo = 1; combo <= 5; combo++) {
      const dialog = new Daily(combo);
      const cards = dialog.children.filter((child): child is Card => child instanceof Card);
      let x = 315,
        index = 0;
      for (let day = 1; day <= 5; day++) {
        if (day === combo) {
          x += 3;
          assert.equal(dialog.boxXPos, x);
          x += 170;
        } else {
          assert.equal(cards[index++].x, x);
          x += 120;
        }
      }
      for (const card of cards) {
        assert.equal(card.y, 347);
        for (const label of [card.textField, card.textField2, card.dayTextField].filter(Boolean))
          assert.equal(label!.wrap, false);
        for (const icon of card.children.filter(
          (child): child is Image => child instanceof Image,
        )) {
          const label = icon === card.image ? card.textField2! : card.textField;
          assert.equal(icon.x - label.x - label.width, 8);
          assert.equal(label.x + (label.width + 8 + icon.width) / 2, 45);
        }
      }
      const before = cards.map((card) => card.x);
      dialog.redraw();
      assert.deepEqual(
        cards.map((card) => card.x),
        before.map((x, index) => x + (index < combo - 1 ? -25 : 25)),
        'redraw reserves the expanded native card without overlapping its neighbor',
      );
      const settled = cards.map((card) => card.x);
      dialog.redraw();
      assert.deepEqual(
        cards.map((card) => card.x),
        settled,
      );
      assert.equal(dialog.dayTextField!.x, dialog.box.x + 80);
      assert.equal(dialog.dayTextField!.y, 478);
      assert.equal(dialog.callback(), 'native reward callback');
    }
    assert.deepEqual(errors, []);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  assert.equal(Object.hasOwn(Daily.prototype, 'addChild'), false);
});
