import { read, type API, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { formatAmount } from '../hud/HealthAndShield';
import { NexarEnemyIdentification } from './NexarEnemyIdentification';

/** Source fixed bitmap viewports and native quads; shield values remain native. */
export class NexarWorldLabel {
  readonly node: Raw;
  private readonly faction: Raw;
  private readonly enemyName: Raw;
  private readonly shieldBackground: Raw;
  private readonly shieldFill: Raw;
  private readonly hpBackground: Raw;
  private readonly hpFill: Raw;
  private readonly shieldValue: Raw;
  private readonly hpValue: Raw;
  private displayedOptions = -1;
  private contentHeight = 0;
  private nextValueUpdate = 0;
  private previousHp = -1;
  private previousHpMax = -1;
  private previousShield = -1;
  private previousShieldMax = -1;

  constructor(
    ui: NativeUI,
    name: string,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.node = ui.sprite();
    this.node.set_touchable(false);
    this.faction = ui.sprite();
    this.node.addChild(this.faction);
    for (const [size, color] of [
      [8, 0xf04b59],
      [3, 0x541923],
    ]) {
      const badge = ui.quad(size, size, color);
      badge.set_pivotX(size / 2);
      badge.set_pivotY(size / 2);
      badge.set_rotation(Math.PI / 4);
      badge.set_x(-25);
      badge.set_y(9);
      this.faction.addChild(badge);
    }
    const text = (width: number, height: number, value: string, size: number, color: number) => {
      const TextField = ui.cls('starling.text.TextField'),
        TextFormat = ui.cls('starling.text.TextFormat');
      const field = new TextField(width, height, value, new TextFormat('DAIDRR_16', size, color));
      field.set_batchable(true);
      field.set_touchable(false);
      return field;
    };
    const factionName = text(52, 18, 'Nexar', 11, 0xff7882);
    factionName.set_x(-17);
    this.faction.addChild(factionName);
    this.enemyName = text(400, 22, NexarEnemyIdentification.displayName(name), 14, 0xffe2df);
    this.enemyName.set_x(-200);
    this.node.addChild(this.enemyName);
    const bar = (color: number) => {
      const quad = ui.quad(146, 16, color);
      quad.set_x(-73);
      this.node.addChild(quad);
      return quad;
    };
    this.shieldBackground = bar(0x10141e);
    this.shieldFill = bar(0x27699c);
    this.hpBackground = bar(0x10141e);
    this.hpFill = bar(0xa52c40);
    this.shieldBackground.set_alpha(0.85);
    this.hpBackground.set_alpha(0.85);
    this.shieldValue = text(146, 16, '', 10, 0xf4f8ff);
    this.hpValue = text(146, 16, '', 10, 0xfff5f5);
    for (const value of [this.shieldValue, this.hpValue]) {
      value.set_x(-73);
      this.node.addChild(value);
    }
  }

  static options(settings: Raw): number {
    return (
      (settings.showNexarFactionLabels ? 1 : 0) |
      (settings.showNexarEnemyNames ? 2 : 0) |
      (settings.showNexarHealthBars ? 4 : 0) |
      (settings.showNexarHealthValues ? 8 : 0)
    );
  }

  draw(game: Raw, ship: Raw, flags: number): void {
    const clip = read(ship, 'movieClip');
    if (
      !flags ||
      !ship.alive ||
      !read(ship, 'isAddedToCanvas') ||
      !clip ||
      !read(clip, 'visible') ||
      read(clip, 'alpha') <= 0 ||
      ship.owner != null
    ) {
      this.hide();
      return;
    }
    const worldScale = Math.abs(read(game.canvas, 'scaleX') * read(game.canvasTexts, 'scaleX'));
    if (!Number.isFinite(worldScale) || worldScale <= 0) {
      this.hide();
      return;
    }
    if (flags !== this.displayedOptions) {
      this.updateLayout(flags);
      this.nextValueUpdate = 0;
    }
    if (flags & 4) {
      this.updateFill(this.shieldFill, ship.shieldHp, ship.shieldHpMax);
      this.updateFill(this.hpFill, ship.hp, ship.hpMax);
    }
    const now = this.now();
    if (flags & 8 && now >= this.nextValueUpdate) {
      this.nextValueUpdate = now + 100;
      this.updateValues(ship);
    }
    const inverse = 1 / worldScale;
    this.node.set_scaleX(inverse);
    this.node.set_scaleY(inverse);
    this.node.set_x(read(ship, 'renderX', read(clip, 'x')));
    const headroom = Math.max(
      ship.collisionRadius,
      Math.abs(read(clip, 'pivotX') * read(clip, 'scaleX')),
      Math.abs(read(clip, 'pivotY') * read(clip, 'scaleY')),
    );
    this.node.set_y(
      read(ship, 'renderY', read(clip, 'y')) - headroom - (this.contentHeight + 8) * inverse,
    );
    this.node.set_alpha(read(clip, 'alpha'));
    if (!read(this.node, 'parent')) game.canvasTexts.addChild(this.node);
  }

  private updateLayout(flags: number): void {
    this.displayedOptions = flags;
    this.faction.set_visible(!!(flags & 1));
    this.enemyName.set_visible(!!(flags & 2));
    const bars = !!(flags & 4),
      values = !!(flags & 8);
    for (const bar of [this.shieldBackground, this.shieldFill, this.hpBackground, this.hpFill])
      bar.set_visible(bars);
    this.shieldValue.set_visible(values);
    this.hpValue.set_visible(values);
    let row = 0;
    if (flags & 1) {
      this.faction.set_y(row);
      row += 18;
    }
    if (flags & 2) {
      this.enemyName.set_y(row);
      row += 22;
    }
    if (bars || values) {
      if (row > 0) row += 2;
      const height = values ? 16 : 5;
      this.shieldBackground.set_y(row);
      this.shieldValue.set_y(row);
      this.shieldFill.set_y(row + 1);
      this.shieldBackground.set_height(height);
      this.hpBackground.set_height(height);
      this.shieldFill.set_height(height - 2);
      this.hpFill.set_height(height - 2);
      row += height + 2;
      this.hpBackground.set_y(row);
      this.hpValue.set_y(row);
      this.hpFill.set_y(row + 1);
      row += height;
    }
    this.contentHeight = row;
  }

  private updateFill(fill: Raw, value: number, maximum: number): void {
    const ratio = maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
    fill.set_visible(ratio > 0);
    if (ratio > 0) {
      fill.set_x(-72);
      fill.set_width(144 * ratio);
    }
  }

  private updateValues(ship: Raw): void {
    if (ship.shieldHp !== this.previousShield || ship.shieldHpMax !== this.previousShieldMax) {
      this.previousShield = ship.shieldHp;
      this.previousShieldMax = ship.shieldHpMax;
      this.shieldValue.set_text(
        formatAmount(Math.max(0, this.previousShield)) +
          ' / ' +
          formatAmount(Math.max(0, this.previousShieldMax)),
      );
    }
    if (ship.hp !== this.previousHp || ship.hpMax !== this.previousHpMax) {
      this.previousHp = ship.hp;
      this.previousHpMax = ship.hpMax;
      this.hpValue.set_text(
        formatAmount(Math.max(0, this.previousHp)) +
          ' / ' +
          formatAmount(Math.max(0, this.previousHpMax)),
      );
    }
  }

  hide(): void {
    this.node.removeFromParent();
  }
  dispose(): void {
    this.node.removeFromParent(true);
  }
}

export function installNexarWorldLabels(api: API, game: Raw): void {
  const enemy = api.cls('core.ship.EnemyShip')?.prototype;
  if (typeof enemy?.draw !== 'function') return;
  const ui = new NativeUI(api),
    labels = new Map<Raw, NexarWorldLabel>(),
    eligibility = new WeakMap<Raw, boolean>();
  api.after(enemy, 'draw', function () {
    if (this.g !== game) return;
    if (!this.alive || !read(this, 'isAddedToCanvas')) {
      labels.get(this)?.hide();
      return;
    }
    let eligible = eligibility.get(this);
    if (eligible === undefined) {
      eligible =
        this.owner == null &&
        NexarEnemyIdentification.isImportant(
          read(this, 'name'),
          this.hasFaction('Nexar'),
          this.miniboss,
          this.isBossUnit,
        );
      eligibility.set(this, eligible);
    }
    if (!eligible) return;
    const flags = NexarWorldLabel.options(api.cls('core.scene.SceneBase')?.clientSettings ?? {});
    let label = labels.get(this);
    if (!label && flags) {
      label = new NexarWorldLabel(ui, read(this, 'name'));
      labels.set(this, label);
    }
    label?.draw(game, this, flags);
  });
  if (typeof enemy.removeFromCanvas === 'function')
    api.before(enemy, 'removeFromCanvas', function () {
      labels.get(this)?.hide();
    });
  for (const method of ['reset', 'destroy'])
    if (typeof enemy[method] === 'function')
      api.before(enemy, method, function () {
        labels.get(this)?.dispose();
        labels.delete(this);
        eligibility.delete(this);
      });
  api.defer(() => {
    for (const label of labels.values()) label.dispose();
    labels.clear();
  });
}
