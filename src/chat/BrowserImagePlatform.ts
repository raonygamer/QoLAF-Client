import { read, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/As3';
import { ChatGifDecoder } from './ChatGifDecoder';
import type { ChatImagePlatform } from './ChatRemoteImageLoader';

/** Browser decoding feeds the game's actual OpenFL bitmap and Starling texture types. */
export function createBrowserImagePlatform(resolve: Resolve): ChatImagePlatform {
  const BitmapData = resolve('openfl.display.BitmapData');
  const Texture = resolve('starling.textures.Texture');
  const Starling = resolve('starling.core.Starling');
  const decoder = new ChatGifDecoder(resolve);
  return {
    fetch: (url, options) => fetch(url, options),
    async decodeStatic(bytes): Promise<Raw> {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      try {
        if (image.width > 4096 || image.height > 4096 || image.width * image.height > 8_000_000)
          throw new Error('Image dimensions are unsupported.');
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image canvas is unavailable.');
        context.drawImage(image, 0, 0);
        const bitmap = BitmapData.fromCanvas(canvas, true);
        if (!bitmap) throw new Error('Image could not be decoded.');
        // Materialize Lime's canvas pixels before Starling uploads them. In
        // this runtime the direct canvas upload swaps red/blue; reading a pixel
        // selects the normalized data upload path (also used by GIF frames).
        try {
          bitmap.getPixel32(0, 0);
        } catch (error) {
          bitmap.dispose();
          throw error;
        }
        return bitmap;
      } finally {
        image.close();
      }
    },
    beginGif: (bytes) => decoder.begin(bytes),
    nextFrame(signal) {
      return new Promise<void>((resolveFrame, reject) => {
        const stage = read(read(Starling, 'current'), 'stage');
        if (!stage) {
          reject(new Error('Image frame scheduler is unavailable.'));
          return;
        }
        const cleanup = () => {
          stage.removeEventListener('enterFrame', frame);
          signal.removeEventListener('abort', aborted);
        };
        const frame = () => {
          cleanup();
          resolveFrame();
        };
        const aborted = () => {
          cleanup();
          reject(signal.reason);
        };
        stage.addEventListener('enterFrame', frame);
        signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted) aborted();
      });
    },
    upload: (bitmap) => Texture.fromBitmapData(bitmap, false, false, 1),
  };
}
