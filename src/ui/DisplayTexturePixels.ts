import type { API } from '../api/Types';

/** Normalize canvas-backed vector pixels before native texture upload and restoration. */
export function installDisplayTexturePixels(api: API): void {
  const textures = api.cls('textures.TextureManager');
  const BitmapData = api.cls('openfl.display.BitmapData');
  if (!textures?.textureFromDisplayObject || !BitmapData?.prototype.draw) return;
  const sources = new WeakSet<object>();
  api.before(textures, 'textureFromDisplayObject', function (source) {
    if (source && typeof source === 'object') sources.add(source);
  });
  api.after(BitmapData.prototype, 'draw', function (_result, source) {
    // The native onRestore callback draws the same display object into a fresh
    // bitmap. Remember the source without retaining it, rather than guarding
    // only the initial synchronous factory call.
    if (source && typeof source === 'object' && sources.has(source)) this.getPixel32(0, 0);
  });
}
