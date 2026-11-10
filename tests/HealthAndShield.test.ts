import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HealthAndShield, formatAmount } from '../src/hud/HealthAndShield';

test('amount formatting preserves original rollover boundaries and signs', () => {
  for (const [value, expected] of [
    [999, '999'],
    [1000, '1k'],
    [1234, '1.2k'],
    [999949, '999.9k'],
    [999950, '1M'],
    [999950000, '1B'],
    [999950000000, '1T'],
    [-1250, '-1.2k'],
  ] as const) {
    assert.equal(formatAmount(value), expected);
  }
});

test('native bars ease like the original without changing ship health or shield mechanics', () => {
  const field = () => ({
    text: '',
    writes: 0,
    set_text(value: string) {
      this.text = value;
      this.writes++;
    },
  });
  const bar = () => ({
    width: 0,
    set_width(value: number) {
      this.width = value;
    },
  });
  const native = {
    playerHPBar: bar(),
    playerShieldBar: bar(),
    playerHPText: field(),
    playerShieldText: field(),
  };
  const settings = { formatHealthAndShield: true };
  const display = new HealthAndShield(native, () => settings);
  const ship = { hp: 2000, shieldHp: 1000, get_hpMax: () => 2000, get_shieldHpMax: () => 1000 };
  display.update(ship);
  assert.equal(native.playerHPBar.width, 120);
  assert.equal(native.playerHPText.text, '2k');
  ship.hp = 0;
  ship.shieldHp = 500;
  display.update(ship);
  assert.equal(native.playerHPBar.width, 120, 'simulation update must not snap the displayed bar');
  display.animate(1);
  assert.ok(
    Math.abs(display.displayedHP - 2000 * Math.exp(-1.2)) < 1e-9,
    'long frames clamp to 100ms',
  );
  assert.equal(ship.hp, 0);
  assert.equal(ship.shieldHp, 500);
  for (let index = 0; index < 100; index++) display.animate(0.1);
  assert.equal(display.displayedHP, 0);
  assert.equal(native.playerShieldBar.width, 60);
  settings.formatHealthAndShield = false;
  display.animate(0);
  assert.equal(native.playerShieldText.text, '500');
  const writes = native.playerShieldText.writes;
  display.animate(0);
  assert.equal(
    native.playerShieldText.writes,
    writes,
    'unchanged text does not rebuild its bitmap',
  );
});
