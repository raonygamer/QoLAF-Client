import { BitmapFont, type MeshBatch, type TextFormat } from '../game/Bindings';
import type { Game } from '../game/Game';
import type { createRichBitmapFontTextRenderer } from './RichBitmapFontTextRenderer';
type Renderer = InstanceType<ReturnType<typeof createRichBitmapFontTextRenderer>>;
/** Native fonts borrow this compositor and acquire a scratch renderer lazily. */
export interface RichBitmapFont extends BitmapFont {
  htmlRenderer?: Renderer | null;
}
/** Geometry belongs to the destination batch; the font renderer is shared scratch state. */
export const bitmapLineTops = new WeakMap<MeshBatch, readonly number[]>();

// Source port of core/text/RichBitmapFontCompositor.as.
import type { Resolve } from '../runtime/HaxeInterop';
export function createRichBitmapFontCompositor(resolve: Resolve) {
  resolve('starling.text.BitmapFont');
  const RichBitmapFontTextRenderer = resolve(
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer',
  ) as ReturnType<typeof createRichBitmapFontTextRenderer>;

  class RichBitmapFontCompositor extends BitmapFont {
    htmlRenderer: Renderer | null = null;

    fillMeshBatch(
      this: RichBitmapFont,
      meshBatch: MeshBatch,
      width: number,
      height: number,
      text: string,
      format: TextFormat,
      options: Game.starling.text.TextOptions | null = null,
    ): void {
      bitmapLineTops.delete(meshBatch);
      // Both plain and rich bitmap output use the cached batching path.
      // Haxe's separate-mesh path intermittently omits labels with valid glyphs.
      meshBatch.set_batchable(true);
      if (options == null || !options.get_isHtmlText()) {
        super.fillMeshBatch(meshBatch, width, height, text, format, options);
        return;
      }
      if (this.htmlRenderer == null) {
        this.htmlRenderer = new RichBitmapFontTextRenderer();
        this.htmlRenderer.set_touchable(false);
        this.htmlRenderer.truncateToFit = false;
        this.htmlRenderer.useSeparateBatch = false;
        this.htmlRenderer.pixelSnapping = true;
      }
      if (!text) return;
      this.htmlRenderer.fillExternalMeshBatch(
        meshBatch,
        width,
        height,
        text,
        this,
        format,
        options,
      );
      bitmapLineTops.set(meshBatch, this.htmlRenderer.copyLineTops());
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
