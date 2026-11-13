import type { createText } from '../ported/Text';
import { installBitmapFontBatching } from './BitmapFontBatching';
import { installWrapTextMeasurement } from './NativeWrapTextMeasurement';
import { installBitmapCompositionQueue } from './BitmapCompositionQueue';
import { fontAssets } from './FontAssets';
import { StarlingTextField } from '../game/Bindings';
import { GameReflection } from '../api/GameReflection';
import type {
  createRichBitmapFontCompositor,
  RichBitmapFont,
} from '../ported/RichBitmapFontCompositor';
import type { API } from '../api/Types';
import { bridgeNativeBitmapText } from './NativeTextBridge';
import { portedClasses } from '../ported/Registry';
import { createBitmapClasses } from './BitmapClasses';

/** Keep native constructor/subclass identity while replacing its text implementation. */
export function installNativeBitmapText(api: API): void {
  const bitmap = createBitmapClasses(portedClasses(api).resolve);
  const Text = bitmap.resolve('core.hud.components.Text') as ReturnType<typeof createText>;
  bridgeNativeBitmapText(api, Text);
  installBitmapCompositionQueue(api);
  installWrapTextMeasurement(api);
  const Compositor = bitmap.resolve('core.text.RichBitmapFontCompositor') as ReturnType<
    typeof createRichBitmapFontCompositor
  >;
  const reflection = new GameReflection(api);
  installBitmapFontBatching(api);
  for (const asset of fontAssets) {
    const font: RichBitmapFont | null = StarlingTextField.getBitmapFont(asset.owner);
    if (!font) throw Error('Missing bitmap font: ' + asset.owner);
    reflection.around(
      font,
      'fillMeshBatch',
      function (next, batch, width, height, text, format, options) {
        if (!options?.get_isHtmlText()) return next(batch, width, height, text, format, options);
        return Compositor.prototype.fillMeshBatch.call(
          this,
          batch,
          width,
          height,
          text,
          format,
          options,
        );
      },
    );
    api.defer(() => {
      font.htmlRenderer?.dispose();
      delete font.htmlRenderer;
    });
  }
}
