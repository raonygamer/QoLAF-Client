import type { API } from '../api/Types';
import { Cargo, TextBitmap, type GameScene } from '../game/Bindings';

/** Preserve the original overload percentage while native code caps the bar. */
export function installCargoCompression(api: API, game: GameScene): void {
  let drawing: Cargo | null = null;
  api.around(Cargo.prototype, 'draw', function (next, animate) {
    const previous = drawing;
    drawing = this.g === game ? this : null;
    try {
      return next(animate);
    } finally {
      drawing = previous;
    }
  });
  api.around(TextBitmap.prototype, 'set_text', function (next, text) {
    // The native percentage field starts as "%" and is assigned before its
    // width is measured for centering. Other text and cargo layout stay native.
    if (drawing && this.get_text() === '%' && /^\d+%$/.test(text)) {
      const player = game.get_me();
      if (!player) return next(text);
      const capacity = drawing.compressorCapacities[player.compressorLevel];
      const fraction = drawing.spaceJunkCount / capacity;
      if (Number.isFinite(fraction) && fraction > 1) text = `${(fraction * 100) | 0}%`;
    }
    return next(text);
  });
}
