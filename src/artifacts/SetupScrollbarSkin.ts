import type { API, Raw } from '../api/Types';

/** Original AeonDesktopTheme.swc atlas regions, authored at 2× scale. */
export function setupScrollbarSkin(api: API, image: string): () => Promise<Record<string, Raw>> {
  let pending: Promise<Record<string, Raw>> | undefined;
  let disposed = false;
  let root: Raw | undefined;
  let pixels: Raw | undefined;
  api.defer(() => {
    disposed = true;
    root?.dispose();
    pixels?.dispose();
  });
  return () =>
    (pending ??= new Promise((resolve, reject) => {
      const Bitmap = api.cls('openfl.display.BitmapData')!;
      const Texture = api.cls('starling.textures.Texture')!;
      const Rectangle = api.cls('openfl.geom.Rectangle') as any;
      const future = Bitmap.loadFromBase64(image.slice(image.indexOf(',') + 1), 'image/png');
      future.onError(reject);
      future.onComplete((bitmap: Raw) => {
        if (disposed) {
          bitmap.dispose();
          resolve({});
          return;
        }
        try {
          pixels = bitmap;
          root = Texture.fromBitmapData(bitmap, false, false, 2);
          const textures: Record<string, Raw> = {};
          for (const [name, x, y, width, height] of [
            ['up', 250, 34, 104, 32],
            ['hover', 355, 1, 104, 32],
            ['down', 250, 1, 104, 32],
            ['icon', 320, 146, 14, 10],
          ] as const)
            textures[name] = Texture.fromTexture(
              root,
              new Rectangle(x / 2, y / 2, width / 2, height / 2),
            );
          resolve(textures);
        } catch (error) {
          reject(error);
        }
      });
    }));
}
