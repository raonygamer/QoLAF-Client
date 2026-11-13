import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProgressBar, MULTIBAR_COLORS } from '../src/ui/ProgressBar';
import { Display } from './fixtures/NativeGame';

function fixture() {
  class Node extends Display {
    text = '';
    writes = 0;
    set_text(value: string) {
      this.text = value;
      this.writes++;
    }
    get_text() {
      return this.text;
    }
    set_color(value: number) {
      this.values.color = value;
    }
    get_format() {
      return { set_color() {} };
    }
    set_blendMode() {}
    set_mask() {}
  }
  const labels: Node[] = [];
  const settings = { formatTargetBarValues: false };
  const classes: Record<string, unknown> = {
    'core.scene.SceneBase': { settings },
    'starling.display.Sprite': Node,
    'starling.display.Quad': Node,
    'starling.display.Image': Node,
    'starling.text.TextFormat': class {},
    'starling.text.TextField': class extends Node {
      constructor(width: number, height: number, text: string) {
        super();
        this.set_width(width);
        this.set_height(height);
        this.text = text;
        labels.push(this);
      }
    },
    'openfl.display.BitmapData': class {
      draw() {}
      dispose() {}
    },
    'openfl.display.Shape': class {
      get_graphics() {
        return { beginGradientFill() {}, drawRect() {}, endFill() {} };
      }
    },
    'openfl.geom.Matrix': class {
      createGradientBox() {}
    },
    'starling.textures.Texture': { fromBitmapData: () => ({ dispose() {} }) },
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as unknown as API);
  const bar = new ProgressBar(300, 14, 0xff0022);
  return {
    bar,
    labels,
    settings,
    trail: (bar.node as unknown as Display).children[1] as Node,
    overlay: (bar.node as unknown as Display).children[2] as Node,
  };
}

test('target bars toggle original compact formatting while retaining hidden values', () => {
  const { bar, labels, settings } = fixture();
  bar.set(1200000, 25000.9);
  bar.update(0.1);
  assert.equal(labels[0].text, '25000 / 1200000');
  settings.formatTargetBarValues = true;
  bar.update(0.1);
  assert.equal(labels[0].text, '25k / 1.2M');
  const writes = labels[0].writes;
  bar.update(0.1);
  assert.equal(labels[0].writes, writes);
  bar.obscured = true;
  bar.update(0.1);
  assert.equal(labels[0].text, '??? / ???');
  assert.equal(labels[1].text, '???x');
});

test('empty multibar clears its trail while an ordinary bar retains damage interpolation', () => {
  const { bar, trail, overlay, labels } = fixture();
  bar.set(20000, 20000);
  bar.update(0);
  bar.set(20000, 0);
  bar.update(1 / 60);
  assert.equal(overlay.get_width(), 0.01);
  assert.equal(trail.get_width(), 0.01);
  assert.equal(labels[1].text, '0x');
  bar.multibar = false;
  bar.update(0);
  assert.ok(trail.get_width() > 250, 'ordinary mode still displays its decaying trail');
  assert.equal(labels[1].text, '');
});

test('multibar changes reset layer colors, but assigning unchanged settings preserves them', (context) => {
  let random = 0;
  context.mock.method(Math, 'random', () => random);
  const { bar, overlay } = fixture();
  bar.set(30000, 15000);
  bar.update(0);
  assert.equal(overlay.values.color, MULTIBAR_COLORS[0]);
  random = 0.4;
  bar.dividend = 10000;
  bar.multibar = true;
  bar.update(0);
  assert.equal(overlay.values.color, MULTIBAR_COLORS[0]);
  bar.multibar = false;
  bar.multibar = true;
  bar.update(0);
  assert.equal(overlay.values.color, MULTIBAR_COLORS[6]);
  random = 0.8;
  bar.dividend = 12000;
  bar.update(0);
  assert.equal(overlay.values.color, MULTIBAR_COLORS[12]);
});

test('multibar dividend follows the source finite fallback and minimum', () => {
  const { bar, overlay, labels } = fixture();
  for (const value of [NaN, Infinity, -Infinity]) {
    bar.dividend = value;
    assert.equal(bar.dividend, 10000);
  }
  for (const value of [0, -50]) {
    bar.dividend = value;
    assert.equal(bar.dividend, 1);
  }
  bar.set(3, 2);
  bar.update(0);
  assert.equal(overlay.get_width(), 300);
  assert.equal(labels[1].text, '2x');
});

test('damage trail advances on each render frame, healing catches up immediately and lower maxima clamp it', () => {
  for (const fps of [30, 60, 120, 180]) {
    const { bar, trail, overlay } = fixture();
    bar.multibar = false;
    bar.set(100, 100);
    bar.update(0);
    bar.set(100, 40);
    let expected = 100;
    for (let frame = 0; frame < fps; frame++) {
      expected += (40 - expected) * Math.min(1, 8 / fps);
      bar.update(1 / fps);
      assert.ok(Math.abs(trail.get_width() - 3 * expected) < 1e-9);
      assert.equal(overlay.get_width(), 120);
    }
    bar.set(100, 90);
    bar.update(0);
    assert.equal(trail.get_width(), 270, 'healing does not lag behind the value');
    bar.set(50, 40);
    bar.update(0);
    assert.equal(trail.get_width(), 300, 'a lower maximum clamps the trail');
    assert.equal(overlay.get_width(), 240);
    bar.dispose();
  }
});

test('partial top multibar layers and exact boundaries retain original capacity math', () => {
  const { bar, overlay, labels } = fixture();
  for (const [value, width, multiplier] of [
    [25000, 300, '3x'],
    [22500, 150, '3x'],
    [20000, 300, '2x'],
    [15000, 150, '2x'],
    [10000, 300, '1x'],
    [5000, 150, '1x'],
    [0, 0.01, '0x'],
  ] as const) {
    bar.set(25000, value);
    bar.update(0);
    assert.equal(overlay.get_width(), width);
    assert.equal(labels[1].text, multiplier);
  }
});

test('ordinary target bars preserve fractional maxima', () => {
  const { bar, overlay } = fixture();
  bar.multibar = false;
  bar.set(0.5, 0.25);
  bar.update(0);
  assert.equal(overlay.get_width(), 150);
});
