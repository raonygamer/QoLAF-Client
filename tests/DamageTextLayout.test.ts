import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDamageText } from '../src/hud/DamageText';
import { bindGameClasses } from '../src/game/Bindings';
import { installCombatTextLayout } from '../src/rendering/CombatTextLayout';
import { Display, Text } from './fixtures/NativeGame';
import type { Raw } from '../src/api/Types';
// @ts-expect-error inspected upstream implementation
import { makeDamageMethod } from './fixtures/UpstreamDamageText.js';
// @ts-expect-error inspected upstream implementation
import makeTextHandler from './fixtures/UpstreamTextHandler.js';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('combined layout and native damage hooks format before measurement while retaining aggregation and zoom', () => {
  class Point {
    constructor(
      public x: number,
      public y: number,
    ) {}
    clone() {
      return new Point(this.x, this.y);
    }
  }
  const measured: string[] = [];
  let fail = false;
  class Particle extends Text {
    speed = new Point(0, 0);
    reset() {}
    set_wordWrap(value: boolean) {
      this.values.wordWrap = value;
    }
    set_pivotX(value: number) {
      this.values.pivotX = value;
    }
    get_textBounds() {
      if (fail) throw Error('layout failure');
      measured.push(this.text);
      return { width: this.text.length * 10, height: 20 };
    }
  }
  const Handler = makeTextHandler();
  const prototype = { createDmgText: makeDamageMethod(Point) };
  const settings = { formatDamageText: true };
  const game = Object.assign(new Display(), {
    time: 1000,
    get_me: () => ({ zoom: 2 }),
    canvasTexts: new Display(),
    textManager: { inactiveTexts: Array.from({ length: 8 }, () => new Particle()) },
  });
  const handler = new Handler(game);
  const manager = Object.assign(Object.create(prototype), {
    g: game,
    textHandler: handler,
    sb: [],
    DAMAGE_TTL: 1000,
    dmgTextCounter: 0,
  });
  const owner: Raw = {
    lastDmgTime: -Infinity,
    lastHealTime: -Infinity,
    get_pos: () => new Point(100, 200),
  };
  const classes: Raw = {
    'core.text.TextManager': { prototype },
    'core.text.TextHandler': Handler,
    'core.scene.SceneBase': { settings },
    'core.text.TextParticle': Particle,
    'starling.text.TextField': Text,
  };
  const hooks = new Hooks(),
    cleanups: Array<() => void> = [];
  const api: any = {
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    cls: (name: string) => classes[name] ?? { prototype: {} },
    around: (object: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'around', fn)),
    after: (object: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'after', fn)),
  };
  bindGameClasses(api);
  installCombatTextLayout(api);
  installDamageText(api, game);
  try {
    manager.createDmgText(12500, owner);
    assert.deepEqual(measured, ['12.5k']);
    assert.equal(owner.lastDmgText.get_width(), 95);
    assert.equal(owner.lastDmgText.values.wordWrap, false);
    assert.equal(owner.lastDmgText.get_format().size, 7.5);
    assert.equal(owner.lastDmgText.baseScale, 1.5);
    assert.equal(owner.lastDmgText.createdZoom, 2);
    assert.equal(owner.lastDmgText.owner, owner);
    game.time += 100;
    manager.createDmgText(500, owner);
    assert.equal(measured.length, 1);
    assert.equal(owner.lastDmgText.text, '13k');
    assert.equal(owner.lastDmg, 13000);
    assert.equal(owner.lastDmgText.ttl, 1000);
    manager.createDmgText(-2000, owner);
    assert.equal(measured.at(-1), '2k');
    owner.lastHealText.ttl = 400;
    game.time += 100;
    manager.createDmgText(-100, owner);
    assert.equal(owner.lastHealText.text, '2.1k');
    assert.equal(owner.lastHealText.speed.y, -16);
    settings.formatDamageText = false;
    game.time += 300;
    manager.createDmgText(999999, owner);
    assert.equal(measured.at(-1), '999999');
    assert.equal(owner.lastDmgText.values.wordWrap, false);
    fail = true;
    game.time += 300;
    assert.throws(() => manager.createDmgText(10, owner), /layout failure/);
    fail = false;
    const notification = handler.add('12345', new Point(0, 0), new Point(0, 0));
    assert.equal(notification.text, '12345');
    assert.equal(notification.values.wordWrap, true);
    settings.formatDamageText = true;
    const other = Object.assign(Object.create(prototype), {
      g: { ...game },
      textHandler: handler,
      sb: [],
      DAMAGE_TTL: 1000,
      dmgTextCounter: 0,
    });
    owner.lastDmgTime = -Infinity;
    other.createDmgText(12500, owner);
    assert.equal(measured.at(-1), '12500');
    assert.equal(owner.lastDmgText.values.wordWrap, true);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});
