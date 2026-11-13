import type { API } from '../src/api/Types';
import { bindGameClasses, type GameScene, type Unit } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuraInfo, auraTooltip } from '../src/ui/AuraInfo';
import { NativeUI } from '../src/ui/NativeUI';
import { registry, EnemyShip, ToolTip, Display } from './fixtures/NativeGame';

test('aura information matches original descriptions using native rare-type constants', () => {
  const native = {
    RARE_TYPE_DEFENDER: 11,
    RARE_TYPE_ATTACKER: 12,
    RARE_TYPE_SPEEDER: 13,
    RARE_TYPE_LEGENDARY: 14,
    RARE_TYPE_UNIQUE: 15,
  };
  assert.equal(auraTooltip(native, 1), '');
  const expected = [
    [11, '00bff5', 'Blue Aura (Defender)', 'HP and shield', '3x', '+1', '+1', '2x'],
    [12, 'b8000a', 'Red Aura (Attacker)', 'Attack damage', '2x', '+1', '+1', '2x'],
    [13, 'ff9970', 'Orange Aura (Speeder)', 'Speed', '2.5x', '+1', '+1', '2x'],
    [14, '44ff44', 'Green Aura (Legendary)', 'HP and shield', '3x', '+3', '+3', '3x'],
    [
      15,
      'ffff22',
      'Gold Aura (Unique)',
      'HP, shield, and attack damage',
      '10x',
      '+6',
      '+10',
      '10x',
    ],
  ] as const;
  for (const [type, color, name, stat, value, drops, level, xp] of expected) {
    const tooltip = auraTooltip(native, type);
    assert.ok(tooltip.startsWith(`<font color='#${color}'>${name}</font><br><br>`));
    for (const [label, amount] of [
      [stat, value],
      ['Additional artifact drops', drops],
      ['Artifact level', level],
      ['Experience', xp],
    ])
      assert.ok(tooltip.includes(`<font color='#cccccc'>${label}:</font> ${amount}<br>`));
  }
});

test('aura button follows target identity, disposes stale tooltips, and leaves enemies unchanged', () => {
  const classes = registry();
  const api = { cls: (name: string) => classes[name] ?? {} } as unknown as API;
  bindGameClasses(api);
  const ui = new NativeUI(api);
  const info = new AuraInfo(ui, {} as GameScene);
  const first = Object.assign(new EnemyShip(), { rareType: EnemyShip.RARE_TYPE_DEFENDER });
  const snapshot = { ...first };
  assert.equal(info.update(first as unknown as Unit, 0x00bff5), true);
  const tooltip = ToolTip.instances.at(-1)!;
  assert.equal(tooltip.target, info.node);
  assert.equal(tooltip.width, 260);
  assert.equal(tooltip.color, 0xffffff);
  assert.equal(info.node.getChildAt(0).get_width(), 20);
  assert.deepEqual({ ...first }, snapshot);
  info.update(first as unknown as Unit, 0x00bff5);
  assert.equal(ToolTip.instances.at(-1), tooltip);
  const second = Object.assign(new EnemyShip(), { rareType: first.rareType });
  info.update(second as unknown as Unit, 0x00bff5);
  assert.equal(tooltip.disposed, true);
  const replacement = ToolTip.instances.at(-1)!;
  assert.notEqual(replacement, tooltip);
  info.update(second as unknown as Unit, 0);
  assert.equal(replacement.disposed, true);
  assert.equal(info.node.get_visible(), false);
  info.update(first as unknown as Unit, 0x00bff5);
  const last = ToolTip.instances.at(-1)!;
  info.dispose();
  assert.equal(last.disposed, true);
  assert.equal((info.node as unknown as Display).disposed, true);
});
