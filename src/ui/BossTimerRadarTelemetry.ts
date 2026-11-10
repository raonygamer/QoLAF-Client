import { read, type Raw } from '../api/Types';
import type { BossTimerRow } from '../boss/BossSpawnTimers';
import { NativeUI } from './NativeUI';

/** Original wrapped Verdana rows; height belongs to the telemetry, not the radar. */
export class BossTimerRadarTelemetry {
  readonly node: Raw;
  blockHeight = 0;
  private slots: {
    label: Raw;
    text: string | null;
    width: number;
    color: number;
    height: number;
  }[] = [];

  constructor(private ui: NativeUI) {
    this.node = ui.sprite();
    this.node.set_touchable(false);
    this.node.set_visible(false);
  }

  refresh(rows: BossTimerRow[], availableWidth: number): void {
    const width = Number.isFinite(availableWidth)
      ? Math.max(1, Math.min(420, availableWidth))
      : 420;
    this.blockHeight = 0;
    let count = 0;
    for (const row of rows) {
      if (!row?.text) continue;
      let slot = this.slots[count];
      if (!slot) {
        const label = this.ui.text(420, 15, '', 10, 0xbfc4cc, 'left', 'QoLAF_Verdana16');
        read(label, 'format').set_verticalAlign('top');
        label.set_wordWrap(true);
        label.set_batchable(true);
        this.node.addChild(label);
        this.slots.push((slot = { label, text: null, width: -1, color: 0xbfc4cc, height: 15 }));
      }
      const { label } = slot;
      if (slot.color !== row.color) {
        read(label, 'format').set_color(row.color);
        slot.color = row.color;
      }
      if (slot.text !== row.text || slot.width !== width) {
        label.set_autoSize('vertical');
        label.set_width(width);
        label.set_text(row.text);
        slot.height = Math.max(15, Math.ceil(read(read(label, 'textBounds'), 'height') / 15) * 15);
        label.set_autoSize('none');
        label.set_height(slot.height);
        slot.text = row.text;
        slot.width = width;
      }
      label.set_visible(true);
      label.set_y(this.blockHeight);
      this.blockHeight += slot.height;
      count++;
    }
    for (let index = count; index < this.slots.length; index++)
      this.slots[index].label.set_visible(false);
    this.node.set_visible(count > 0);
  }
}
