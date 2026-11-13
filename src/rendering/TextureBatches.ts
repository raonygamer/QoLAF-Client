import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { TextureManager } from '../game/Bindings';
import { TextureBatch } from './TextureBatch';

export function installTextureBatches(api: API): void {
  const reflection = new GameReflection(api);
  const batches = new Map<TextureManager, TextureBatch>();
  reflection.around(TextureManager.prototype, 'loadTextures', function (_next, files) {
    batches.get(this)?.dispose();
    const batch = new TextureBatch(this, reflection, files);
    batches.set(this, batch);
    batch.start();
  });
  reflection.before(TextureManager.prototype, 'dispose', function () {
    batches.get(this)?.dispose();
    batches.delete(this);
  });
  api.defer(() => {
    for (const batch of batches.values()) batch.dispose();
    batches.clear();
  });
}
