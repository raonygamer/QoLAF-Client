import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DebuffTracker, installDebuffTracker } from '../src/debuff/DebuffTracker';
import { DebuffDisplay, debuffTooltip } from '../src/ui/DebuffDisplay';
import { Display, Image, ToolTip } from './fixtures/NativeGame';

test('debuff observations preserve native shield/healing behavior and arguments', () => {
  const hooks = new Map<string, Function>();
  const game = { time: 1000 };
  const native = { doDOTEffect() {}, reset() {}, destroy() {} };
  const api: any = {
    cls: () => ({ prototype: native }),
    before: (_target: any, name: string, hook: Function) => hooks.set(name, hook),
  };
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
  const ui: any = {
    sprite: () => new Display(),
    texture: (name: string) => ({ name }),
    image: (texture: any) => new Image(texture),
    cls: () => ToolTip,
    dispose: (node: Display) => node.dispose(),
  };
  const display = new DebuffDisplay(ui, game, tracker);
  for (const type of [0, 1, 3, 5]) tracker.record(unit, type, 20000);
  display.update(unit, false, 'Target');
  const images = [...display.node.children];
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
  assert.equal(display.node.children.length, 0);
  assert.ok(tips.every((tip) => tip.hidden && tip.text === ''));
  display.update(unit, false, 'Target');
  assert.equal(ToolTip.instances.length, tips.length);
  game.time = 20000;
  display.update(unit, false, 'Target');
  assert.equal(display.node.children.length, 0);
  display.dispose();
  assert.ok(images.every((image) => image.disposed));
  assert.ok(tips.every((tip) => tip.disposed));
});
