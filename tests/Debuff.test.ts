import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DebuffEffect, DebuffTracker, installDebuffTracker } from '../src/debuff/DebuffTracker';
import { DebuffDisplay, debuffTooltip } from '../src/ui/DebuffDisplay';
import { Display, Image, ToolTip } from './fixtures/NativeGame';

test('debuff observations preserve native shield/healing behavior and arguments', () => {
  const hooks = new Map<string, Function>();
  const game = { time: 1000 };
  const native = { doDOTEffect() {}, reset() {}, destroy() {} };
  const api: any = {
    cls: () => ({ prototype: native }),
    defer: () => {},
    before: (_target: any, name: string, hook: Function) => hooks.set(name, hook),
  };
  bindGameClasses(api);
  const tracker = installDebuffTracker(api, game);
  const unit = { g: game, alive: true, shieldRegenCounter: -2400, disableHealEndtime: 6500 };
  const snapshot = { ...unit };
  for (const type of [5, 6, 11]) {
    const args = [8, null, type, 'native description'];
    assert.equal(hooks.get('doDOTEffect')!.apply(unit, args), undefined);
    assert.deepEqual(args, [8, null, type, 'native description']);
  }
  assert.deepEqual(unit, snapshot);
  assert.deepEqual(
    tracker.get(unit).map((effect) => effect.debuff),
    [5, 6, 11],
  );
  const other = { ...unit, g: { time: 1000 } };
  hooks.get('doDOTEffect')!.call(other, 8, null, 5);
  assert.equal(tracker.get(other).length, 0);
  hooks.get('destroy')!.call(unit);
  assert.equal(tracker.get(unit).length, 0);
  hooks.get('doDOTEffect')!.call(unit, 8, null, 5);
  hooks.get('reset')!.call(unit);
  assert.equal(tracker.get(unit).length, 0);
  hooks.get('doDOTEffect')!.call(unit, 1, null, 1);
  game.time += 1000;
  hooks.get('update')!.call(unit);
  hooks.get('doDOTEffect')!.call(unit, 1, null, 1);
  assert.equal(tracker.get(unit)[0].stacks, 1, 'native update expires unobserved units too');
  assert.equal(unit.shieldRegenCounter, snapshot.shieldRegenCounter);
  assert.equal(unit.disableHealEndtime, snapshot.disableHealEndtime);
});

test('original debuff stacking, refresh, expiry and countdown formatting', () => {
  let now = 0;
  const tracker = new DebuffTracker(() => now);
  const unit = { alive: true };
  for (const id of [0, 1, 3, 5]) tracker.record(unit, id, 20000);
  now = 1000;
  for (const id of [0, 1, 3, 5]) tracker.record(unit, id, 10000);
  assert.deepEqual(
    tracker.get(unit).map((effect) => effect.stacks),
    [1, 2, 2, 1],
  );
  assert.match(debuffTooltip(tracker.get(unit)[1], now, 'Target'), /x2.*#ff3030.*10s/);
  assert.match(debuffTooltip(tracker.get(unit)[1], now, 'Target'), /Target is taking stacking/);
  now = 11000;
  assert.equal(tracker.get(unit).length, 0);
  for (const id of [-1, 12, NaN, 1.5]) tracker.record(unit, id, 5000);
  tracker.record({ alive: false }, 1, 5000);
  assert.equal(tracker.get(unit).length, 0);
  tracker.record(unit, 1, 60000);
  assert.match(debuffTooltip(tracker.get(unit)[0], now, 'Target'), /1m /);
});

test('native debuff icons hide protected stats, reuse entries, and release tooltips', () => {
  const game = { time: 0 };
  const tracker = new DebuffTracker(() => game.time);
  const unit = { alive: true };
  class Scene {}
  Object.setPrototypeOf(game, Scene.prototype);
  const api: any = {
    cls: (name: string) =>
      name === 'core.scene.SceneBase' ? Scene : name === 'starling.display.Image' ? Image : ToolTip,
    defer: () => {},
  };
  bindGameClasses(api);
  const ui: any = {
    api,
    sprite: () => new Display(),
    texture: (name: string) => ({ name }),
    findTexture: () => null,
    image: (texture: any) => new Image(texture),
    cls: () => ToolTip,
    dispose: (node: Display) => node.dispose(),
  };
  const display = new DebuffDisplay(
    ui,
    game as unknown as import('../src/game/Bindings').GameScene,
    tracker,
  );
  for (const type of [0, 1, 3, 5]) tracker.record(unit, type, 20000);
  display.update(unit, false, 'Target');
  const images = [...(display.node as unknown as Display).children];
  assert.ok(
    images.every((image) => (image as Image).texture.name === 'ti_astro_lance_levels'),
    'missing debuff art retains the original fallback icon',
  );
  assert.equal(images.length, 3); // Original metadata has no icon for type 3.
  assert.equal(display.height, 23);
  assert.deepEqual(
    images.map((image) => [image.get_x(), image.get_y(), image.get_width(), image.get_height()]),
    [
      [0, 2, 21, 21],
      [23, 2, 21, 21],
      [46, 2, 21, 21],
    ],
  );
  const tips = [...ToolTip.instances];
  assert.ok(tips.every((tip) => tip.color === 0xffffff && tip.width === 260));
  display.update(unit, true, 'Target');
  assert.equal(display.height, 0);
  assert.equal((display.node as unknown as Display).children.length, 0);
  assert.ok(tips.every((tip) => tip.hidden && tip.text === ''));
  display.update(unit, false, 'Target');
  assert.equal(ToolTip.instances.length, tips.length);
  game.time = 20000;
  display.update(unit, false, 'Target');
  assert.equal((display.node as unknown as Display).children.length, 0);
  display.dispose();
  assert.ok(images.every((image) => image.disposed));
  assert.ok(tips.every((tip) => tip.disposed));
});

test('debuff constructor and countdown boundaries match original source', () => {
  const effect = new DebuffEffect(1, -10, 100);
  assert.equal(effect.duration, 0);
  assert.equal(effect.remaining(100), 0);
  effect.refresh(5000, 200);
  effect.refresh(-1, 300);
  assert.equal(effect.duration, 5000, 'negative refresh duration preserves the existing duration');
  assert.equal(effect.stacks, 3);
  const cases: Array<[number, string]> = [
    [0, '0s'],
    [1, '1s'],
    [10000, '10s'],
    [10001, '11s'],
    [59999, '60s'],
    [60000, '1m '],
    [60001, '1m 1s'],
    [3600000, '1h '],
    [3661000, '1h 1m 1s'],
  ];
  for (const [duration, time] of cases) {
    const timed = new DebuffEffect(0, duration, 0);
    const color = duration <= 10000 ? '#ff3030' : '#ffffff';
    assert.ok(debuffTooltip(timed, 0, 'Target').includes(`<font color='${color}'>${time}</font>`));
  }
});

test('stack refresh follows source update ordering across the expiry boundary', () => {
  let now = 0;
  const tracker = new DebuffTracker(() => now);
  const unit = { alive: true };
  tracker.record(unit, 1, 100);
  now = 100;
  tracker.record(unit, 1, 100);
  assert.equal(
    tracker.get(unit)[0].stacks,
    2,
    'packet arriving before expiry update refreshes existing stack',
  );
  now = 200;
  tracker.get(unit); // Target display explicitly updates expiry, as in the source.
  tracker.record(unit, 1, 100);
  assert.equal(tracker.get(unit)[0].stacks, 1, 'after expiry update a new stack begins');
});
