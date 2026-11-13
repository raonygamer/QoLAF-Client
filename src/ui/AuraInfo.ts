import type { Sprite, StarlingTextField } from '../game/Bindings';
import type { GameScene, Unit, EnemyShip } from '../game/Bindings';
import { NativeUI } from './NativeUI';
import { ToolTip } from '../game/Bindings';
import { styleClientTooltip } from './NativeTooltip';

/** Descriptive UI from RareAuraStyle.as; never applies enemy stat modifiers. */
export function auraTooltip(
  enemyClass: Pick<
    typeof EnemyShip,
    | 'RARE_TYPE_DEFENDER'
    | 'RARE_TYPE_ATTACKER'
    | 'RARE_TYPE_SPEEDER'
    | 'RARE_TYPE_LEGENDARY'
    | 'RARE_TYPE_UNIQUE'
  >,
  type: number,
): string {
  const line = (label: string, value: string) =>
    `<font color='#cccccc'>${label}:</font> ${value}<br>`;
  let title: string,
    color: string,
    stats: [string, string][],
    drops: string,
    level: string,
    xp: string;
  switch (type) {
    case enemyClass.RARE_TYPE_DEFENDER:
      title = 'Blue Aura (Defender)';
      color = '00bff5';
      stats = [['HP and shield', '3x']];
      drops = '+1';
      level = '+1';
      xp = '2x';
      break;
    case enemyClass.RARE_TYPE_ATTACKER:
      title = 'Red Aura (Attacker)';
      color = 'b8000a';
      stats = [['Attack damage', '2x']];
      drops = '+1';
      level = '+1';
      xp = '2x';
      break;
    case enemyClass.RARE_TYPE_SPEEDER:
      title = 'Orange Aura (Speeder)';
      color = 'ff9970';
      stats = [['Speed', '2.5x']];
      drops = '+1';
      level = '+1';
      xp = '2x';
      break;
    case enemyClass.RARE_TYPE_LEGENDARY:
      title = 'Green Aura (Legendary)';
      color = '44ff44';
      stats = [
        ['HP and shield', '3x'],
        ['Attack damage', '2x'],
        ['Speed', '2.5x'],
      ];
      drops = '+3';
      level = '+3';
      xp = '3x';
      break;
    case enemyClass.RARE_TYPE_UNIQUE:
      title = 'Gold Aura (Unique)';
      color = 'ffff22';
      stats = [
        ['HP, shield, and attack damage', '10x'],
        ['Speed', '2.5x'],
      ];
      drops = '+6';
      level = '+10';
      xp = '10x';
      break;
    default:
      return '';
  }
  return (
    `<font color='#${color}'>${title}</font><br><br>` +
    stats.map(([label, value]) => line(label, value)).join('') +
    line('Additional artifact drops', drops) +
    line('Artifact level', level) +
    line('Experience', xp)
  );
}

let nextTooltipId = 0;
export class AuraInfo {
  readonly node: Sprite;
  private readonly label: StarlingTextField;
  private readonly tooltipType = `qolafAuraInfo${++nextTooltipId}`;
  private tooltip?: ToolTip;
  private unit: Unit | null = null;
  private type = -1;

  constructor(
    private readonly ui: NativeUI,
    private readonly game: GameScene,
  ) {
    this.node = ui.sprite();
    this.node.addChild(ui.quad(20, 20, 0x101010, 0.9));
    this.label = ui.text(20, 20, '?', 13, 0xffffff, 'center');
    this.node.addChild(this.label);
    this.node.set_visible(false);
  }

  update(unit: Unit | null, color: number): boolean {
    const enemyClass = this.ui.cls('core.ship.EnemyShip');
    const type = unit instanceof enemyClass ? unit.rareType : -1;
    const text = color ? auraTooltip(enemyClass, type) : '';
    if (unit !== this.unit || type !== this.type || !text) this.clearTooltip();
    this.unit = unit;
    this.type = type;
    this.node.set_visible(!!text);
    if (!text) return false;
    this.label.get_format().set_color(color);
    if (!this.tooltip) {
      this.tooltip = new ToolTip(this.game, this.node, text, null, this.tooltipType, 260);
      styleClientTooltip(this.tooltip);
      this.tooltip.set_color(0xffffff);
    }
    return true;
  }

  private clearTooltip(): void {
    if (!this.tooltip) return;
    ToolTip.disposeType(this.tooltipType);
    this.tooltip = undefined;
  }

  dispose(): void {
    this.clearTooltip();
    this.unit = null;
    this.ui.dispose(this.node);
  }
}
