import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayerShip, type TextBitmap } from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import { installKillOnSightLabels } from './KillOnSightLabels';

/** Source PlayerShip constructor styling, applied to native labels without replacing them. */
export function applyPlayerNameStyle(text: TextBitmap): () => void {
  const format = text.get_format();
  const alpha = text.get_alpha();
  const blendMode = text.get_blendMode();
  const font = format.get_font();
  text.set_alpha(1);
  text.set_blendMode('normal');
  format.set_font(RussoBitmapFontRegistry.COMBAT_FONT_NAME);
  text.autoWidth();
  return () => {
    text.set_alpha(alpha);
    text.set_blendMode(blendMode);
    format.set_font(font);
    text.autoWidth();
  };
}

export function installPlayerNameStyle(api: API): void {
  installKillOnSightLabels(api);
  const reflection = new GameReflection(api);
  const styles = new Map<PlayerShip, () => void>();
  const restore = (ship: PlayerShip) => {
    styles.get(ship)?.();
    styles.delete(ship);
  };
  reflection.before(PlayerShip.prototype, 'draw', function () {
    if (styles.has(this)) return;
    const restoreName = applyPlayerNameStyle(this.nameText);
    const restoreLevel = applyPlayerNameStyle(this.levelText);
    styles.set(this, () => {
      restoreName();
      restoreLevel();
    });
  });
  for (const method of ['reset', 'destroy'] as const) {
    reflection.before(PlayerShip.prototype, method, function () {
      restore(this);
    });
  }
  api.defer(() => {
    for (const restoreStyle of styles.values()) restoreStyle();
    styles.clear();
  });
}
