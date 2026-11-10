import { type Raw } from '../Api/Types';
import { DebuffEffect, type DebuffTracker } from '../Debuff/DebuffTracker';
import { debuffInfo } from '../Debuff/DebuffInfo';
import { NativeUI } from './NativeUI';

type Entry = { image: Raw; tooltip: Raw; text: string };
let nextTooltipId = 0;

export function debuffTooltip(effect: DebuffEffect, now: number, name: string): string {
  const info = debuffInfo.find((entry) => entry.id === effect.debuff);
  const remaining = effect.remaining(now);
  const hours = Math.trunc(remaining / 3600000);
  const minutes = Math.trunc((remaining % 3600000) / 60000);
  const seconds = Math.ceil((remaining % 60000) / 1000);
  let time = hours > 0 ? `${hours}h ` : '';
  if (minutes > 0) time += `${minutes}m `;
  if (seconds > 0 || !time) time += `${seconds}s`;
  return (
    `<font color='#ffffff'>${info?.name ?? 'Unknown Debuff'} x${effect.stacks}</font>  ` +
    `<font color='${remaining <= 10000 ? '#ff3030' : '#ffffff'}'>${time}</font><br><br>` +
    (info?.enemy_description ?? 'Unknown Debuff Description').split('[enemy]').join(name)
  );
}

/** Original 21px debuff icon grid, sharing the game's native ToolTip system. */
export class DebuffDisplay {
  readonly node: Raw;
  height = 0;
  private readonly fallback: Raw;
  private readonly tooltipType = `qolafTargetDebuff${++nextTooltipId}`;
  private readonly entries = new Map<DebuffEffect, Entry>();
  private readonly pool: Entry[] = [];
  constructor(
    private readonly ui: NativeUI,
    private readonly game: Raw,
    private readonly tracker: DebuffTracker,
  ) {
    this.node = ui.sprite();
    this.fallback = ui.texture('ti_astro_lance_levels', 'texture_gui1_test.png');
  }
  update(unit: Raw | null, hidden: boolean, name: string): void {
    const effects =
      unit && !hidden
        ? this.tracker
            .get(unit)
            .filter((effect) => debuffInfo.some((info) => info.id === effect.debuff))
        : [];
    for (const [effect, entry] of this.entries) {
      if (effects.includes(effect)) continue;
      entry.image.removeFromParent();
      entry.tooltip.set_text('');
      entry.tooltip.hide();
      entry.text = '';
      entry.image.set_texture(this.fallback);
      entry.image.set_alpha(1);
      this.pool.push(entry);
      this.entries.delete(effect);
    }
    effects.forEach((effect, index) => {
      let entry = this.entries.get(effect);
      if (!entry) {
        entry = this.pool.pop() ?? this.create();
        const info = debuffInfo.find((info) => info.id === effect.debuff)!;
        entry.image.set_texture(
          this.ui.texture(info.icon, 'texture_gui1_test.png') ?? this.fallback,
        );
        entry.image.set_color(0xffffff);
        entry.image.set_width(21);
        entry.image.set_height(21);
        this.node.addChild(entry.image);
        this.entries.set(effect, entry);
      }
      entry.image.set_x((index % 13) * 23);
      entry.image.set_y(2 + Math.floor(index / 13) * 23);
      const text = debuffTooltip(effect, this.game.time, name);
      if (text !== entry.text) {
        entry.tooltip.set_text(text);
        entry.text = text;
      }
    });
    this.height = effects.length ? 2 + Math.ceil(effects.length / 13) * 23 - 2 : 0;
    this.node.set_visible(!hidden && effects.length > 0);
  }
  private create(): Entry {
    const image = this.ui.image(this.fallback);
    image.set_touchable(true);
    const Tooltip = this.ui.cls('core.hud.components.ToolTip');
    const tooltip = new Tooltip(this.game, image, '', null, this.tooltipType, 260);
    tooltip.set_color(0xffffff);
    return { image, tooltip, text: '' };
  }
  dispose(): void {
    this.ui.cls('core.hud.components.ToolTip').disposeType(this.tooltipType);
    for (const entry of this.pool) entry.image.dispose();
    this.pool.length = 0;
    this.entries.clear();
    this.ui.dispose(this.node);
  }
}
