import { BitmapFont } from '../game/Bindings';
import { GameReflection } from '../api/GameReflection';
import type { API } from '../api/Types';

/** Keep native and port font geometry on the same Starling batching path. */
export function installBitmapFontBatching(api: API): void {
  const reflection = new GameReflection(api);
  // Include upstream font13/font26 labels: separate draws also disturb nearby
  // cached UI labels. Retain the native compositor's layout and glyph metrics.
  reflection.before(BitmapFont.prototype, 'fillMeshBatch', function (batch) {
    batch.set_batchable(true);
  });
}
