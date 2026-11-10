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
  const ui: any = {
    api: { cls: () => ({ settings }) },
    sprite: () => new Node(),
    quad: () => new Node(),
    image: () => new Node(),
    place() {},
    cls: (name: string) =>
      name === 'openfl.display.BitmapData'
        ? class {
            setPixel32() {}
            dispose() {}
          }
        : { fromBitmapData: () => ({ dispose() {} }) },
    text: () => {
      const label = new Node();
      labels.push(label);
      return label;
    },
  };
  const bar = new ProgressBar(ui, 300, 14, 0xff0022);
  return {
    bar,
    labels,
    settings,
    trail: bar.node.children[1] as Node,
    overlay: bar.node.children[2] as Node,
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
