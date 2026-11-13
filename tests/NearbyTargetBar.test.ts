import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindGameClasses, type Unit, type GameScene } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import { NativeUI } from '../src/ui/NativeUI';
import { NearbyTargetBar } from '../src/ui/NearbyTargetBar';
import { createTargetBossIcon } from '../src/ui/TargetBossIcon';
import { TargetPresentation } from '../src/target/TargetPresentation';
import { Display, Quad, Text, Format, Image, Filter } from './fixtures/NativeGame';

function fixture() {
  class MatrixFilter extends Filter {
    matrix: number[] = [];
    concatValues(...values: number[]) {
      this.matrix = values;
    }
  }
  const texture = { width: 32, height: 24 };
  const classes: Record<string, any> = {
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
    'starling.display.Image': Image,
    'starling.text.TextField': Text,
    'starling.text.TextFormat': Format,
    'starling.filters.GlowFilter': Filter,
    'starling.filters.ColorMatrixFilter': MatrixFilter,
    'textures.TextureLocator': {
      getService: () => ({ getTextureGUIByTextureName: () => texture }),
    },
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as unknown as API);
  return { ui: new NativeUI({ cls: (name: string) => classes[name] } as any), texture };
}

test('both boss icon sizes apply the source white RGB transform and preserve alpha', () => {
  const { ui, texture } = fixture();
  for (const size of [16, 18]) {
    const icon = createTargetBossIcon(size) as unknown as Image;
    assert.equal(icon.texture, texture);
    assert.equal(icon.get_width(), size);
    assert.equal(icon.get_height(), size * 0.75);
    assert.equal(icon.get_touchable(), false);
    const matrix = (icon.get_filter() as Filter & { matrix: number[] }).matrix;
    const pixel = [19, 88, 137, 0.4];
    const output = [0, 1, 2, 3].map(
      (row) =>
        matrix[row * 5 + 4] +
        pixel.reduce((sum, value, column) => sum + matrix[row * 5 + column] * value, 0),
    );
    assert.deepEqual(output, [255, 255, 255, 0.4]);
  }
});

test('nearby row keeps its pressed background across refresh and restores hidden/known fills', () => {
  const { ui } = fixture();
  let hidden = false;
  const info: any = {
    bossIcon: () => false,
    level: () => 90,
    name: () => 'Pilot',
    aura: () => 0,
    hideStats: () => hidden,
    values: () => ({ hp: 50, hpMax: 100, shield: 0, shieldMax: 100 }),
  };
  const selected: any[] = [],
    unit = {} as Unit;
  const row = new NearbyTargetBar(info, (unit) => selected.push(unit));
  const display = row.node as unknown as Display;
  const background = display.getChildAt(0) as Quad,
    health = display.getChildAt(1) as Quad,
    shield = display.getChildAt(2) as Quad;
  const touch = (phase?: string) => {
    for (const listener of display.listeners('touch'))
      listener({ getTouch: () => (phase ? { get_phase: () => phase } : null) });
  };
  row.show(unit, 100, 0.01);
  touch('began');
  row.show(unit, 101, 0.01);
  assert.equal(background.get_color(), 0x303030, 'refresh must not erase the held touch');
  assert.equal(health.get_width(), 150);
  assert.equal(shield.get_visible(), false);
  hidden = true;
  row.show(unit, 102, 0.01);
  assert.equal(health.get_color(), 0x777777);
  assert.equal(shield.get_color(), 0x777777);
  assert.equal(health.get_width(), 300);
  assert.equal(shield.get_visible(), true);
  touch('ended');
  assert.equal(background.get_color(), 0x050505);
  assert.deepEqual(selected, [unit]);
  hidden = false;
  row.show(unit, 103, 0.01);
  assert.equal(health.get_color(), 0x8b1524);
  assert.equal(shield.get_color(), 0x2769d8);
  touch('began');
  row.show(null, 0, 0.01);
  touch('ended');
  assert.equal(background.get_color(), 0x050505);
  assert.equal(selected.length, 1);
  row.dispose();
});

test('hostile player statistics are obscured except for matching group identity', () => {
  class PlayerShip {
    isHostile = true;
    player = { get_group: () => group };
  }
  let group: any = null;
  const game = { get_me: () => ({ get_group: () => ({ get_id: () => 'ours' }) }) };
  bindGameClasses({
    cls: (name: string) => (name === 'core.ship.PlayerShip' ? PlayerShip : {}),
  } as unknown as API);
  const info = new TargetPresentation(game as unknown as Pick<GameScene, 'get_me'>);
  const ship = new PlayerShip() as PlayerShip & Unit;
  assert.equal(info.hideStats(ship), true);
  group = { get_id: () => 'theirs' };
  assert.equal(info.hideStats(ship), true);
  group = { get_id: () => 'ours' };
  assert.equal(info.hideStats(ship), false);
  group = { get_id: () => undefined };
  assert.equal(info.hideStats(ship), true, 'missing group IDs never establish membership');
  group = null;
  ship.isHostile = false;
  assert.equal(info.hideStats(ship), false);
  assert.equal(
    info.hideStats({ isHostile: true } as Unit),
    false,
    'NPCs retain visible statistics',
  );
});
