import { createTargetBossIcon } from './TargetBossIcon';
import {
  Sprite,
  Quad,
  StarlingTextField,
  TextFormat,
  type Image,
  type Unit,
  type TouchEvent,
} from '../game/Bindings';
import { RussoBitmapFontRegistry } from './RussoBitmapFontRegistry';
import { AuraText } from './AuraText';
import { TargetPresentation, levelColor } from '../target/TargetPresentation';
// qolaf/ui/elements/NearbyTargetBar.as — 300×27, original fills and spacing.
export class NearbyTargetBar {
  readonly node: Sprite;
  unit: Unit | null = null;
  private background: Quad;
  private health: Quad;
  private shield: Quad;
  private boss: Image;
  private level: StarlingTextField;
  private name: AuraText;
  private distance: StarlingTextField;
  constructor(
    private info: TargetPresentation,
    select: (unit: Unit) => void,
  ) {
    this.node = new Sprite();
    this.background = new Quad(300, 27, 0x050505);
    this.background.set_alpha(0.82);
    this.health = new Quad(1, 27, 0x8b1524);
    this.health.set_alpha(0.72);
    this.shield = new Quad(1, 4, 0x2769d8);
    this.shield.set_alpha(0.95);
    this.shield.set_y(23);
    this.boss = createTargetBossIcon(16);
    this.boss.set_x(6);
    this.boss.set_y((27 - this.boss.get_height()) / 2);
    this.level = new StarlingTextField(
      50,
      27,
      '',
      new TextFormat(RussoBitmapFontRegistry.UI_24_FONT_NAME, 12, 0xffffff, 'left', 'center'),
    );
    this.level.set_pixelSnapping(false);
    this.level.set_wordWrap(false);
    this.level.set_autoSize('horizontal');
    this.name = new AuraText(1, 27, 12);
    this.distance = new StarlingTextField(
      56,
      27,
      '',
      new TextFormat(RussoBitmapFontRegistry.UI_24_FONT_NAME, 11, 0xbbbbbb, 'right', 'center'),
    );
    this.distance.set_pixelSnapping(false);
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
    this.node.addEventListener('touch', (event: TouchEvent) => {
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
    this.node.set_visible(false);
  }
  show(unit: Unit | null, distance: number, dt: number) {
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
      this.shield.set_width(0.01);
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
    this.unit = null;
    if (this.node.get_parent()) this.node.removeFromParent(true);
    else this.node.dispose();
  }
}
