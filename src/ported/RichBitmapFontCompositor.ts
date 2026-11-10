// Source port of core/text/RichBitmapFontCompositor.as.
import type { Resolve } from '../runtime/As3';
export function createRichBitmapFontCompositor(resolve: Resolve): any {
  const BitmapFont = resolve('starling.text.BitmapFont');
  const RichBitmapFontTextRenderer = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  );

  class RichBitmapFontCompositor extends BitmapFont {
    private htmlRenderer: any = null;

    fillMeshBatch(
      meshBatch: any,
      width: number,
      height: number,
      text: string,
      format: any,
      options: any = null,
    ): void {
      if (options == null || !options.isHtmlText) {
        super.fillMeshBatch(meshBatch, width, height, text, format, options);
        return;
      }
      if (this.htmlRenderer == null) {
        this.htmlRenderer = new RichBitmapFontTextRenderer();
        this.htmlRenderer.touchable = false;
        this.htmlRenderer.truncateToFit = false;
        this.htmlRenderer.useSeparateBatch = false;
        this.htmlRenderer.pixelSnapping = true;
      }
      // Haxe's separate-mesh path corrupts surrounding cached draw ranges
      // for copied rich geometry. Keep this bitmap output in the batching
      // path, matching the source renderer's useSeparateBatch=false policy.
      meshBatch.set_batchable(true);
      this.htmlRenderer.fillExternalMeshBatch(
        meshBatch,
        width,
        height,
        text,
        this,
        format,
        options,
      );
    }

    dispose(): void {
      if (this.htmlRenderer != null) {
        this.htmlRenderer.dispose();
        this.htmlRenderer = null;
      }
      super.dispose();
    }
  }
  return RichBitmapFontCompositor;
}
