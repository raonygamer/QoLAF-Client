import { read, type Raw } from '../Api/Types';
import type { DebuffTracker } from '../Debuff/DebuffTracker';
import { DebuffDisplay } from './DebuffDisplay';
import { NativeUI } from './NativeUI';
import { ProgressBar } from './ProgressBar';
import { AuraText } from './AuraText';
import { AuraInfo } from './AuraInfo';
import { NearbyTargetBar } from './NearbyTargetBar';
import { TargetPresentation, levelColor } from '../Target/TargetPresentation';
import type { TargetSystem } from '../Target/TargetSystem';
import type { Settings } from '../Settings/Settings';
// TargetInfoElement.as: native display-list port; no HTML counterpart.
export class TargetInfo {
  readonly node: Raw;
  private lock: Raw;
  private unlockTexture: Raw;
  private lockTexture: Raw;
  private boss: Raw;
  private level: Raw;
  private name: AuraText;
  private auraInfo: AuraInfo;
  private collapse: Raw;
  private collapseText: Raw;
  private shield: ProgressBar;
  private health: ProgressBar;
  private rows: NearbyTargetBar[] = [];
  private nearby: Raw[] = [];
  private refresh = 0;
  private info: TargetPresentation;
  private debuffs?: DebuffDisplay;
  constructor(
    private ui: NativeUI,
    private game: Raw,
    private target: TargetSystem,
    private config: Settings,
    private save: () => void,
    debuffs?: DebuffTracker,
  ) {
    this.node = ui.sprite();
    this.info = new TargetPresentation(ui, game);
    if (debuffs) {
      this.debuffs = new DebuffDisplay(ui, game, debuffs);
      this.node.addChild(this.debuffs.node);
    }
    this.lockTexture = ui.texture('ti_cargo_protection', 'texture_gui1_test.png');
    this.unlockTexture = ui.texture('ti_cargo_protection_inactive', 'texture_gui1_test.png');
    this.lock = ui.image(this.unlockTexture);
    this.lock.set_scaleX(0.5);
    this.lock.set_scaleY(0.5);
    this.node.addChild(this.lock);
    ui.touch(this.lock, () => {
      if (target.current && target.valid(target.current)) target.locked = !target.locked;
    });
    this.boss = ui.image(ui.texture('radar_boss'));
    const scale = 18 / Math.max(this.boss.get_width(), this.boss.get_height());
    this.boss.set_scaleX(scale);
    this.boss.set_scaleY(scale);
    this.boss.set_touchable(false);
    this.node.addChild(this.boss);
    this.level = ui.text(55, 20, '', 14);
    this.level.set_autoSize('horizontal');
    this.node.addChild(this.level);
    this.name = new AuraText(ui, 188, 20, 14);
    this.node.addChild(this.name.node);
    this.auraInfo = new AuraInfo(ui, game);
    this.node.addChild(this.auraInfo.node);
    this.collapse = ui.sprite();
    this.collapse.addChild(ui.quad(22, 20, 0x101010, 0.9));
    this.collapseText = ui.text(22, 20, '-', 16, 0xdddddd, 'center', 'DAIDRR_16');
    this.collapse.addChild(this.collapseText);
    this.node.addChild(this.collapse);
    ui.touch(this.collapse, () => {
      config.target_list_expanded = !config.target_list_expanded;
      save();
    });
    this.shield = new ProgressBar(ui, 300, 14, 0x3377ff);
    this.health = new ProgressBar(ui, 300, 14, 0xff0022);
    this.node.addChild(this.shield.node);
    this.node.addChild(this.health.node);
  }
  update(dt: number) {
    const stage = read(this.game, 'stage');
    if (!stage) return;
    this.node.set_x(Math.round((read(stage, 'stageWidth') - 300) * this.config.target_info_x));
    this.node.set_y(Math.round((read(stage, 'stageHeight') - 53) * this.config.target_info_y));
    while (this.rows.length < this.config.nearby_enemy_radar_lines) {
      const row = new NearbyTargetBar(this.ui, this.info, (u) => {
        if (
          this.target.valid(u) &&
          u.isHostile &&
          !this.target.excluded(u) &&
          this.target.select(u, true)
        )
          this.target.locked = true;
      });
      this.rows.push(row);
      this.node.addChild(row.node);
    }
    while (this.rows.length > this.config.nearby_enemy_radar_lines) this.rows.pop()!.dispose();
    const unit = this.target.current,
      hidden = !!unit && this.info.hideStats(unit);
    let y = 25;
    this.lock.set_alpha(unit ? 1 : 0.4);
    this.lock.set_texture(this.target.locked ? this.lockTexture : this.unlockTexture);
    this.boss.set_visible(!!unit && this.info.bossIcon(unit));
    this.level.set_text(unit ? 'Lv. ' + this.info.level(unit) : '--');
    this.level.get_format().set_color(unit ? levelColor(this.info.level(unit)) : 0x777777);
    this.name.text(unit ? this.info.name(unit) : 'No active target');
    const auraColor = unit ? this.info.aura(unit) : 0;
    this.name.auraColor(auraColor);
    const hasAura = this.auraInfo.update(unit, auraColor);
    this.name.update(dt);
    let x = this.lock.get_width() + 6;
    if (this.boss.get_visible()) {
      this.boss.set_x(x);
      x += this.boss.get_width() + 6;
    }
    this.level.set_x(x);
    x += this.level.get_width() + 6;
    this.name.node.set_x(x);
    const nameWidth = Math.max(60, 300 - x - 28 - (hasAura ? 26 : 0));
    this.name.viewport(nameWidth, 20);
    x += nameWidth + 6;
    if (hasAura) {
      this.auraInfo.node.set_x(x);
      x += 26;
    }
    this.collapse.set_x(x);
    for (const child of [
      this.lock,
      this.boss,
      this.level,
      this.name.node,
      this.auraInfo.node,
      this.collapse,
    ])
      child.set_y((25 - child.get_height()) / 2);
    this.collapseText.set_text(this.config.target_list_expanded ? '-' : '+');
    const v = unit ? this.info.values(unit) : { hp: 0, hpMax: 0, shield: 0, shieldMax: 0 };
    for (const [bar, max, value] of [
      [this.shield, v.shieldMax, v.shield],
      [this.health, v.hpMax, v.hp],
    ] as const) {
      bar.obscured = hidden;
      bar.multibar = this.config.multibar_mode;
      bar.dividend = this.config.multibar_dividend;
      bar.set(max, value);
      bar.update(dt);
      const visible = !!unit && (hidden || max > 0);
      bar.node.set_visible(visible);
      if (visible) {
        bar.node.set_y(y);
        y += 14;
      }
    }
    this.refresh = Math.max(0, this.refresh - Math.max(0, dt));
    if (this.config.target_list_expanded && this.refresh <= 0) {
      const seen = new Set(),
        active = unit ? this.info.identity(unit) : null;
      this.nearby = this.game.unitManager.units
        .filter((u: Raw) => {
          if (
            u === unit ||
            !u.isHostile ||
            !this.target.valid(u) ||
            this.target.excluded(u) ||
            this.target.distance(u) >= this.config.target_search_distance
          )
            return false;
          const id = this.info.identity(u);
          if (id === active || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .sort((a: Raw, b: Raw) => this.info.compare(a, b, (u) => this.target.distance(u)))
        .slice(0, this.rows.length);
      this.refresh = 0.25;
    }
    if (this.debuffs) {
      this.debuffs.node.set_y(y);
      this.debuffs.update(unit, hidden, unit ? this.info.name(unit) : '');
      y += this.debuffs.height;
    }
    y += 2;
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const u = this.nearby[i];
      row.node.set_y(y + i * 30);
      row.show(
        u &&
          this.target.valid(u) &&
          u.isHostile &&
          !this.target.excluded(u) &&
          u !== unit &&
          this.target.distance(u) < this.config.target_search_distance
          ? u
          : null,
        u ? this.target.distance(u) : 0,
        dt,
      );
      row.node.set_visible(this.config.target_list_expanded);
    }
  }
  dispose() {
    this.debuffs?.dispose();
    this.auraInfo.dispose();
    for (const row of this.rows) row.dispose();
    this.shield.dispose();
    this.health.dispose();
    this.name.dispose();
    this.ui.dispose(this.node);
  }
}
