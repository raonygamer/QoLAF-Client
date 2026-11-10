import type { Resolve } from '../runtime/As3';

/** Replaces Flash TextLine rasterization while retaining the source cache metrics. */
export function createJapaneseRasterizer(resolve: Resolve) {
  const BitmapData = resolve('openfl.display.BitmapData');
  const Rectangle = resolve('openfl.geom.Rectangle');
  const Point = resolve('openfl.geom.Point');
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | null = null;
  const sourceRect = new Rectangle();
  const destination = new Point();
  let width = 0;
  let height = 0;

  return {
    rasterize(text: string, family: string, size: number) {
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = canvas.height = 56;
        context = canvas.getContext('2d');
      }
      if (!context) return null;
      context.clearRect(0, 0, 56, 56);
      context.font = `${size}px "${family}"`;
      context.textBaseline = 'alphabetic';
      context.fillStyle = '#ffffff';
      const metrics = context.measureText(text);
      const left = -metrics.actualBoundingBoxLeft;
      const top = -metrics.actualBoundingBoxAscent;
      const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
      const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      if (inkWidth <= 0 || inkHeight <= 0 || inkWidth > 50 || inkHeight > 50) return null;
      width = Math.ceil(inkWidth);
      height = Math.ceil(inkHeight);
      context.fillText(text, -left, -top);
      return { left, top, width, height, advance: metrics.width };
    },
    copyTo(bitmap: any, x: number, y: number) {
      if (!canvas) throw Error('Rasterize a glyph before copying its pixels');
      const glyphBitmap = BitmapData.fromCanvas(canvas, true);
      sourceRect.setTo(0, 0, width, height);
      destination.setTo(x, y);
      bitmap.copyPixels(glyphBitmap, sourceRect, destination);
      glyphBitmap.dispose();
    },
  };
}
