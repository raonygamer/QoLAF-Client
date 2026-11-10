import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProgressBar } from '../src/UI/ProgressBar';
import { Display } from './Fixtures/NativeGame';

test('target bars toggle original compact formatting while retaining hidden values', () => {
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
    set_color() {}
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
  const bar = new ProgressBar(ui);
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
