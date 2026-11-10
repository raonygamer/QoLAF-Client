import { installWrapTextMeasurement } from './NativeWrapTextMeasurement';
import { installBitmapCompositionQueue } from './BitmapCompositionQueue';
import { fontAssets } from './FontAssets';
import { read } from '../Api/Types';
import type { API } from '../Api/Types';
import { bridgeNativeBitmapText } from './NativeTextBridge';
import { portedClasses } from '../Ported/Registry';
import { createBitmapClasses } from './BitmapClasses';

/** Keep native constructor/subclass identity while replacing its text implementation. */
export function installNativeBitmapText(api: API): void {
  const bitmap = createBitmapClasses(portedClasses(api).resolve);
  const Text = bitmap.resolve('core.hud.components.Text');
  bridgeNativeBitmapText(api, Text);
  installBitmapCompositionQueue(api);
  installWrapTextMeasurement(api);
  const Compositor = bitmap.resolve('core.text.RichBitmapFontCompositor');
  const TextField = api.cls('starling.text.TextField')!;
  for (const asset of fontAssets) {
    const font = TextField.getBitmapFont(asset.owner);
    if (!font) throw Error('Missing bitmap font: ' + asset.owner);
    api.around(font, 'fillMeshBatch', function (next, batch, width, height, text, format, options) {
      if (!read(options, 'isHtmlText', false))
        return next(batch, width, height, text, format, options);
      return Compositor.prototype.fillMeshBatch.call(
        this,
        batch,
        width,
        height,
        text,
        format,
        options,
      );
    });
    api.defer(() => {
      font.htmlRenderer?.dispose();
      delete font.htmlRenderer;
    });
  }
}
