import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BossTimerRadarTelemetry } from '../src/ui/BossTimerRadarTelemetry';
import { Display } from './fixtures/NativeGame';

test('boss rows wrap to 15px multiples, update colors, reuse slots and release unused height', () => {
  class Label extends Display {
    text = '';
    writes = 0;
    format = {
      set_verticalAlign() {},
      set_color: (color: number) => {
        this.values.color = color;
      },
    };
    get_format() {
      return this.format;
    }
    set_wordWrap() {}
    set_batchable() {}
    set_autoSize(value: string) {
      this.values.autoSize = value;
    }
    set_text(text: string) {
      this.text = text;
      this.writes++;
    }
    get_textBounds() {
      return { height: this.values.width < 200 ? 29 : 12 };
    }
  }
  const view = new BossTimerRadarTelemetry({
    sprite: () => new Display(),
    text: () => new Label(),
  } as any);
  const rows = [
    { id: 'boss:a', text: 'Boss is alive.', color: 0x88e1a0 },
    { id: 'boss:b', text: 'Boss spawn expected now (est.).', color: 0xf2d675 },
  ];
  view.refresh(rows, 420);
  assert.equal(view.blockHeight, 30);
  const labels = view.node.children as Label[];
  assert.equal(labels[1].values.y, 15);
  assert.equal(labels[0].values.color, 0x88e1a0);
  assert.equal(labels[0].values.autoSize, 'none');
  view.refresh(rows, 100);
  assert.equal(view.blockHeight, 60);
  assert.equal(labels[1].values.y, 30);
  const writes = labels[0].writes;
  rows[0].color = 0x9aa3b2;
  view.refresh(rows, 100);
  assert.equal(labels[0].values.color, 0x9aa3b2);
  assert.equal(labels[0].writes, writes);
  view.refresh(rows.slice(0, 1), 420);
  assert.equal(view.blockHeight, 15);
  assert.equal(labels[1].get_visible(), false);
  view.refresh([], 420);
  assert.equal(view.blockHeight, 0);
  assert.equal(view.node.get_visible(), false);
});
