import { createTargetBossIcon } from './TargetBossIcon';
import type { Raw } from '../api/Types';
import { NativeUI } from './NativeUI';
import { AuraText } from './AuraText';
import { TargetPresentation, levelColor } from '../target/TargetPresentation';
// qolaf/ui/elements/NearbyTargetBar.as — 300×27, original fills and spacing.
export class NearbyTargetBar {
  readonly node: Raw;
  unit: Raw | null = null;
  private background: Raw;
  private health: Raw;
  private shield: Raw;
  private boss: Raw;
  private level: Raw;
  private name: AuraText;
  private distance: Raw;
  constructor(
    private ui: NativeUI,
    private info: TargetPresentation,
    select: (unit: Raw) => void,
  ) {
    this.node = ui.sprite();
    this.background = ui.quad(300, 27, 0x050505, 0.82);
    this.health = ui.quad(1, 27, 0x8b1524, 0.72);
    this.shield = ui.quad(1, 4, 0x2769d8, 0.95);
    this.shield.set_y(23);
    this.boss = createTargetBossIcon(ui, 16);
    ui.place(this.boss, 6, (27 - this.boss.get_height()) / 2);
    this.level = ui.text(50, 27, '', 12);
    this.level.set_autoSize('horizontal');
    this.name = new AuraText(ui, 1, 27, 12);
    this.distance = ui.text(56, 27, '', 11, 0xbbbbbb, 'right');
    this.distance.set_x(239);
    for (const child of [
      this.background,
      this.health,
      this.shield,
      this.boss,
      this.level,
      this.name.node,
      this.distance,
    ]) {
      this.node.addChild(child);
      if (child !== this.background) child.set_touchable(false);
    }
    this.node.addEventListener('touch', (event: Raw) => {
      const touch = event.getTouch(this.node);
      if (!touch) {
        this.background.set_color(0x050505);
        return;
      }
      const phase = touch.get_phase();
      if (phase === 'began') this.background.set_color(0x303030);
      else if (phase === 'ended') {
        this.background.set_color(0x050505);
        if (this.unit) select(this.unit);
      }
    });
    this.show(null, 0, 0);
  }
  show(unit: Raw | null, distance: number, dt: number) {
    this.unit = unit;
    this.node.set_visible(true);
    if (!unit) {
      this.background.set_color(0x050505);
      this.level.set_text('');
      this.boss.set_visible(false);
      this.name.label.get_format().set_color(0x777777);
      this.name.text('No nearby enemy');
      this.name.auraColor(0);
      this.name.node.set_x(6);
      this.name.viewport(232, 27);
      this.distance.set_text('');
      this.health.set_width(0.01);
      this.shield.set_visible(false);
      return;
    }
    const boss = this.info.bossIcon(unit);
    this.boss.set_visible(boss);
    this.level.set_x(boss ? 26 : 6);
    this.level.set_text('Lv. ' + this.info.level(unit));
    this.level.get_format().set_color(levelColor(this.info.level(unit)));
    const left = this.level.get_x() + this.level.get_width() + 6;
    this.name.node.set_x(left);
    this.name.viewport(Math.max(1, 238 - left), 27);
    this.name.label.get_format().set_color(0xffffff);
    this.name.text(this.info.name(unit));
    this.name.auraColor(this.info.aura(unit));
    this.name.update(dt);
    this.distance.set_text(Math.round(Math.max(0, distance)) + 'm');
    const hidden = this.info.hideStats(unit),
      v = this.info.values(unit);
    const ratio = (n: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, n / max)) : 0);
    this.health.set_color(hidden ? 0x777777 : 0x8b1524);
    this.shield.set_color(hidden ? 0x777777 : 0x2769d8);
    this.health.set_width(hidden ? 300 : Math.max(0.01, 300 * ratio(v.hp, v.hpMax)));
    this.shield.set_width(hidden ? 300 : Math.max(0.01, 300 * ratio(v.shield, v.shieldMax)));
    this.shield.set_visible(hidden || (v.shieldMax > 0 && v.shield > 0));
  }
  dispose() {
    this.name.dispose();
    this.ui.dispose(this.node);
  }
}
