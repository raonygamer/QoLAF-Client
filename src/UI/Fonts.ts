import type { API, Raw } from '../Api/Types';
import russo24 from '../assets/russo24_bitmap.png';
import russo24XML from '../assets/russo24_bitmap.fnt';
import russo16 from '../assets/russo16_bitmap.png';
import russo16XML from '../assets/russo16_bitmap.fnt';
import verdana16 from '../assets/verdana16_bitmap.png';
import verdana16XML from '../assets/verdana16_bitmap.fnt';
const assets = [
  ['DAIDRR_24', russo24, russo24XML],
  ['DAIDRR_16', russo16, russo16XML],
  ['QoLAF_Verdana16', verdana16, verdana16XML],
];
// The original checked-in bitmap sheets are embedded in the one module, not redrawn.
export function loadFonts(api: API): Promise<void> {
  const BitmapData = api.cls('openfl.display.BitmapData')!,
    Texture = api.cls('starling.textures.Texture')!;
  const BitmapFont: any = api.cls('starling.text.BitmapFont'),
    TextField = api.cls('starling.text.TextField')!;
  return Promise.all(
    assets.map(
      ([name, url, xml]) =>
        new Promise<void>((resolve, reject) => {
          if (TextField.getBitmapFont(name)) {
            resolve();
            return;
          }
          const future = BitmapData.loadFromBase64(url.slice(url.indexOf(',') + 1), 'image/png');
          future.onError(reject);
          future.onComplete((bitmap: Raw) => {
            try {
              const texture = Texture.fromBitmapData(bitmap, false, false, 1);
              const font = new BitmapFont(texture, xml);
              font.set_smoothing('bilinear');
              // Texture retains bitmap for context restoration, as the original registry does.
              TextField.registerBitmapFont(font, name);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        }),
    ),
  ).then(() => {});
}
