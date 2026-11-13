import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { TextureManager, TextureAtlas, type Texture } from '../game/Bindings';

let frames = new WeakMap<TextureAtlas, Map<string, readonly Texture[]>>();

export function invalidateTextureFrames(atlas: TextureAtlas): void {
  frames.delete(atlas);
}

/** Cache native frame lookup by atlas identity; never expose the cached array. */
export function installTextureFrames(api: API): void {
  const reflection = new GameReflection(api);
  frames = new WeakMap();
  reflection.around(
    TextureManager.prototype,
    'getTexturesByTextureName',
    function (_next, name, key) {
      if (!name) throw new Error('Texture filename can not be null or empty.');
      if (!key) throw new Error('Texture atlas can not be null or empty.');
      const atlas = TextureManager.textureAtlasDict.h[key];
      if (!reflection.is(atlas, 'starling.textures.TextureAtlas'))
        throw new Error(`Texture atlas is null! key: ${key}`);
      const prefix = name.replace(/\.(png|jpe?g)$/i, '');
      let atlasFrames = frames.get(atlas);
      if (!atlasFrames) {
        atlasFrames = new Map();
        frames.set(atlas, atlasFrames);
      }
      let cached = atlasFrames.get(prefix);
      if (!cached) {
        const result: Texture[] = [];
        const iterator = atlas.getTextures(prefix).iterator();
        while (iterator.hasNext()) result.push(iterator.next());
        cached = result;
        atlasFrames.set(prefix, cached);
      }
      return cached.slice();
    },
  );
  reflection.before(TextureAtlas.prototype, 'dispose', function () {
    invalidateTextureFrames(this);
  });
  reflection.before(TextureManager.prototype, 'dispose', () => {
    frames = new WeakMap();
  });
  api.defer(() => {
    frames = new WeakMap();
  });
}
