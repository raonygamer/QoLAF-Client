import type { API } from '../api/Types';
import { BitmapData, BitmapFont, Texture, StarlingTextField as TextField } from '../game/Bindings';
import { fontAssets } from './FontAssets';

/** Texture roots retain the original bitmap for Starling context restoration. */
export function loadFonts(api: API): Promise<void> {
  let alive = true;
  const aliases: { name: string; previous: BitmapFont | null; font: BitmapFont }[] = [];
  api.defer(() => {
    alive = false;
    for (const { name, previous, font } of aliases.reverse()) {
      if (TextField.getBitmapFont(name) !== font) continue;
      if (previous) TextField.registerBitmapFont(previous, name);
      else TextField.unregisterBitmapFont(name, false);
    }
  });
  return Promise.all(
    fontAssets.map(
      (asset) =>
        new Promise<void>((resolve, reject) => {
          const registerAliases = (font: BitmapFont) => {
            if (alive)
              for (const name of asset.aliases) {
                aliases.push({ name, previous: TextField.getBitmapFont(name), font });
                TextField.registerBitmapFont(font, name);
              }
            resolve();
          };
          const existing = TextField.getBitmapFont(asset.owner);
          if (existing) {
            registerAliases(existing);
            return;
          }
          const future = BitmapData.loadFromBase64(
            asset.image.slice(asset.image.indexOf(',') + 1),
            'image/png',
          );
          future.onError(reject);
          future.onComplete((bitmap: BitmapData) => {
            if (!alive) {
              bitmap.dispose();
              resolve();
              return;
            }
            try {
              const texture = Texture.fromBitmapData(bitmap, asset.mipmaps, false, 1);
              const font = new BitmapFont(texture, asset.xml);
              font.set_smoothing(asset.mipmaps ? 'trilinear' : 'bilinear');
              TextField.registerBitmapFont(font, asset.owner);
              registerAliases(font);
            } catch (error) {
              reject(error);
            }
          });
        }),
    ),
  ).then(() => {});
}
