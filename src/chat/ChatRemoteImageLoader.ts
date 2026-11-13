import type { Texture } from '../game/Bindings';
export interface ChatImageBitmap {
  readonly width: number;
  readonly height: number;
  dispose(): void;
}
import type { ChatImageLoader } from './ChatImageCache';
import { ChatImageAsset } from './ChatImageAsset';

interface GIFTask {
  readonly width: number;
  readonly height: number;
  readonly complete: boolean;
  nextFrame(): { bitmap: ChatImageBitmap; delay: number } | null;
  dispose(): void;
}
export interface ChatImagePlatform {
  fetch(url: string, options: RequestInit): Promise<Response>;
  decodeStatic(bytes: Uint8Array): Promise<ChatImageBitmap>;
  beginGIF(bytes: Uint8Array): GIFTask;
  nextFrame(signal: AbortSignal): Promise<void>;
  upload(bitmap: ChatImageBitmap): Texture;
}

/** Source remote loader policy adapted to cancellable browser I/O and game-frame uploads. */
export class ChatRemoteImageLoader implements ChatImageLoader {
  private static readonly maxEncodedBytes = 20 * 1024 * 1024;
  private static readonly candidateTimeoutMs = 20_000;
  private static readonly maxAnimatedGIFPixels = 60_000;
  private generation = 0;
  private controller: AbortController | null = null;

  constructor(private readonly platform: ChatImagePlatform) {}

  load(
    url: string,
    onComplete: (asset: ChatImageAsset) => void,
    onFailed: (reason: string) => void,
  ): void {
    this.loadCandidates([url], onComplete, onFailed);
  }

  loadCandidates(
    urls: string[],
    onComplete: (asset: ChatImageAsset) => void,
    onFailed: (reason: string) => void,
  ): void {
    this.cancel();
    const candidates = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))];
    if (!candidates.length) {
      onFailed('Invalid image URL.');
      return;
    }
    const generation = this.generation;
    void this.run(candidates, generation).then(
      (asset) => {
        if (!asset) return;
        if (generation !== this.generation) asset.dispose();
        else onComplete(asset);
      },
      (error) => {
        if (generation === this.generation) onFailed(this.reason(error));
      },
    );
  }

  cancel(): void {
    this.generation++;
    this.controller?.abort(new Error('Image request cancelled.'));
    this.controller = null;
  }

  private async run(candidates: string[], generation: number): Promise<ChatImageAsset | null> {
    let lastFailure = 'Image could not be loaded.';
    for (const url of candidates) {
      if (generation !== this.generation) return null;
      const controller = new AbortController();
      this.controller = controller;
      const timer = setTimeout(
        () => controller.abort(new Error('Image request timed out.')),
        ChatRemoteImageLoader.candidateTimeoutMs,
      );
      let status = 0;
      try {
        const response = await this.abortable(
          this.platform.fetch(url, {
            signal: controller.signal,
            credentials: 'omit',
            headers: { Accept: 'image/png,image/jpeg,image/gif,image/*;q=0.5' },
          }),
          controller.signal,
          (late) => {
            void late.body?.cancel().catch(() => {});
          },
        );
        status = response.status;
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`Image could not be loaded (HTTP ${status}).`);
        }
        const bytes = await this.readResponse(response, controller.signal);
        return await this.decode(bytes, controller.signal);
      } catch (error) {
        if (generation !== this.generation) return null;
        lastFailure = this.reason(error);
        if (status > 0 && !lastFailure.includes('HTTP ')) lastFailure += ` (HTTP ${status})`;
      } finally {
        clearTimeout(timer);
        controller.abort();
        if (this.controller === controller) this.controller = null;
      }
    }
    throw new Error(lastFailure);
  }

  private async readResponse(response: Response, signal: AbortSignal): Promise<Uint8Array> {
    if (Number(response.headers.get('content-length')) > ChatRemoteImageLoader.maxEncodedBytes) {
      await response.body?.cancel();
      throw new Error('Image response is too large.');
    }
    if (!response.body) throw new Error('Image response is too large or empty.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const chunk = await this.abortable(reader.read(), signal);
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > ChatRemoteImageLoader.maxEncodedBytes)
          throw new Error('Image response is too large.');
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!length) throw new Error('Image response is too large or empty.');
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }

  private async decode(bytes: Uint8Array, signal: AbortSignal): Promise<ChatImageAsset> {
    const signature = String.fromCharCode(...bytes.subarray(0, 6));
    const gif = signature === 'GIF87a' || signature === 'GIF89a';
    if (gif) {
      if (bytes.length < 10) throw new Error('GIF dimensions are unsupported.');
      const width = bytes[6] | (bytes[7] << 8);
      const height = bytes[8] | (bytes[9] << 8);
      this.checkDimensions(width, height);
      if (width * height <= ChatRemoteImageLoader.maxAnimatedGIFPixels)
        return this.decodeGIF(bytes, signal);
    }
    const bitmap = await this.abortable(this.platform.decodeStatic(bytes), signal, (late) =>
      late.dispose(),
    );
    try {
      signal.throwIfAborted();
      this.checkDimensions(bitmap.width, bitmap.height);
      const texture = this.platform.upload(bitmap);
      return new ChatImageAsset([texture], [100], bitmap.width, bitmap.height, [bitmap]);
    } catch (error) {
      bitmap.dispose();
      throw error;
    }
  }

  private async decodeGIF(bytes: Uint8Array, signal: AbortSignal): Promise<ChatImageAsset> {
    const task = this.platform.beginGIF(bytes);
    const textures: Texture[] = [],
      bitmaps: ChatImageBitmap[] = [],
      delays: number[] = [];
    try {
      while (!task.complete) {
        await this.platform.nextFrame(signal);
        signal.throwIfAborted();
        const frame = task.nextFrame();
        if (!frame) continue;
        bitmaps.push(frame.bitmap);
        textures.push(this.platform.upload(frame.bitmap));
        delays.push(frame.delay);
      }
      if (!textures.length) throw new Error('GIF contains no frames.');
      return new ChatImageAsset(textures, delays, task.width, task.height, bitmaps);
    } catch (error) {
      for (const texture of textures) texture.dispose();
      for (const bitmap of bitmaps) bitmap.dispose();
      throw error;
    } finally {
      task.dispose();
    }
  }

  private checkDimensions(width: number, height: number): void {
    if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || width * height > 8_000_000)
      throw new Error('Image dimensions are unsupported.');
  }

  private reason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private abortable<T>(
    promise: Promise<T>,
    signal: AbortSignal,
    discard?: (value: T) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const aborted = () => {
        if (!settled) {
          settled = true;
          reject(signal.reason);
        }
      };
      signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) aborted();
      promise.then(
        (value) => {
          signal.removeEventListener('abort', aborted);
          if (settled) discard?.(value);
          else {
            settled = true;
            resolve(value);
          }
        },
        (error) => {
          signal.removeEventListener('abort', aborted);
          if (!settled) {
            settled = true;
            reject(error);
          }
        },
      );
    });
  }
}
