import type { API } from '../api/Types';
import { PlayerShip, TextBitmap, Style } from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';

export function killOnSightMarker(id: string | undefined): { text: string; color: number } | null {
  if (id === 'steam76561199175782109') return { text: ' (Soft KoS)', color: 0x48cfff };
  if (id === 'simple1785239895147' || id === 'steam76561199793920727')
    return { text: ' (KoS)', color: Style.COLOR_HOSTILE };
  return null;
}

/** Original PlayerShip KoS assignments and combined name/level/marker alignment. */
export function installKillOnSightLabels(api: API): void {
  const labels = new Map<PlayerShip, TextBitmap>();
  const dispose = (ship: PlayerShip) => {
    const label = labels.get(ship);
    if (!label) return;
    label.removeFromParent();
    label.dispose();
    labels.delete(ship);
  };
  api.after(PlayerShip.prototype, 'draw', function () {
    const id = this.player?.id;
    const marker = killOnSightMarker(id);
    const parent = this.nameText.get_parent();
    if (!marker || !parent || this.get_landed()) {
      dispose(this);
      return;
    }
    let label = labels.get(this);
    if (!label) {
      label = new TextBitmap(0, 0, '', 13);
      label.get_format().set_font(RussoBitmapFontRegistry.COMBAT_FONT_NAME);
      label.get_format().set_horizontalAlign('left');
      label.set_alpha(1);
      label.set_batchable(true);
      label.set_blendMode('normal');
      label.set_touchable(false);
      labels.set(this, label);
    }
    const text = marker.text;
    if (label.get_text() !== text) {
      label.set_text(text);
      label.autoWidth();
    }
    label.get_format().set_color(marker.color);
    if (label.get_parent() !== parent) parent.addChild(label);
    label.set_visible(this.nameText.get_visible());
    // Native draw has already centered the name alone at the rendered position.
    const shift = (this.levelText.get_width() + label.get_width()) * 0.5;
    this.nameText.set_x(this.nameText.get_x() - shift);
    this.levelText.set_x(this.nameText.get_x() + this.nameText.get_width());
    this.supporterIcon.set_x(this.nameText.get_x() - 15);
    label.set_x(this.levelText.get_x() + this.levelText.get_width());
    label.set_y(this.nameText.get_y());
  });
  api.after(PlayerShip.prototype, 'hideStats', function () {
    labels.get(this)?.set_visible(false);
  });
  for (const method of ['removeFromCanvas', 'reset', 'destroy'] as const)
    api.before(PlayerShip.prototype, method, function () {
      dispose(this);
    });
  api.defer(() => {
    for (const ship of labels.keys()) dispose(ship);
  });
}
