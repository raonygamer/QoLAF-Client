import type { Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  TextureManager,
  ImageLoader,
  URLLoader,
  URLRequest,
  LoaderContext,
  Event,
  type Bitmap,
} from '../game/Bindings';
import { TextureAtlasPairs, disposeTextureBitmap } from './TextureAtlasPairs';

interface Item {
  name: string;
  complete: boolean;
  fraction: number;
  cancel?: Cleanup;
}

/** Concurrent file transport with native retry URLs and source batch settlement. */
export class TextureBatch {
  private readonly pairs = new TextureAtlasPairs();
  private readonly items: Item[];
  private cancelled = false;
  private completed = false;

  constructor(
    private readonly manager: TextureManager,
    private readonly reflection: GameReflection,
    names: string[],
  ) {
    this.items = [...new Set(names)].map((name) => ({ name, complete: false, fraction: 0 }));
  }

  start(): void {
    this.manager.itemsArray = this.items.map((item) => item.name);
    this.manager.totalItems = this.items.length;
    this.manager.pLoaded = 0;
    for (const item of this.items) {
      if (this.cancelled) break;
      this.startItem(item, 0);
    }
    if (this.items.length === 0) this.finish();
  }

  dispose(): void {
    this.cancelled = true;
    for (const item of this.items) item.cancel?.();
    this.pairs.dispose();
  }

  private startItem(item: Item, attempt: number): void {
    try {
      this.load(item, attempt);
    } catch {
      item.cancel?.();
      this.fail(item);
    }
  }

  private load(item: Item, attempt: number): void {
    if (this.cancelled || item.complete) return;
    const image = /\.(png|jpe?g)$/i.test(item.name);
    // Original preload batches count unsupported entries as settled, rather
    // than reporting a required texture failure and aborting login.
    if (!image && !/\.xml$/i.test(item.name)) return this.settle(item);
    const imageLoader = image ? new ImageLoader() : null;
    const textLoader = image ? null : new URLLoader();
    const target = imageLoader?.contentLoaderInfo ?? textLoader!;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const detach = () => {
      clearTimeout(timer);
      target.removeEventListener('progress', progress);
      target.removeEventListener('complete', complete);
      target.removeEventListener('ioError', failed);
      target.removeEventListener('securityError', failed);
    };
    const abort = () => {
      try {
        imageLoader?.close();
      } catch {
        /* Already completed or closed. */
      }
      try {
        textLoader?.close();
      } catch {
        /* Already completed or closed. */
      }
      if (imageLoader) {
        try {
          const content = imageLoader.content;
          if (this.reflection.is(content, 'openfl.display.Bitmap')) disposeTextureBitmap(content);
        } catch {
          /* A failed cross-origin load can make content inaccessible. */
        }
        try {
          imageLoader.unloadAndStop(true);
        } catch {
          /* Native loader may already be unloaded. */
        }
      }
    };
    const progress = () => {
      if (settled || this.cancelled) return;
      // Source armLoadTimeout is an inactivity watchdog. A large atlas may
      // download for longer than the timeout while still making progress.
      clearTimeout(timer);
      timer = setTimeout(failed, TextureManager.LOAD_TIMEOUT_MS);
      if (target.bytesTotal > 0)
        item.fraction = Math.min(1, target.bytesLoaded / target.bytesTotal);
      this.progress();
    };
    const complete = () => {
      if (settled || this.cancelled) return;
      settled = true;
      detach();
      item.cancel = undefined;
      let bitmap: Bitmap | null = null;
      try {
        if (imageLoader) {
          bitmap = this.reflection.cast(imageLoader.content, 'openfl.display.Bitmap');
          this.pairs.image(item.name, bitmap);
        } else {
          if (typeof textLoader?.data !== 'string')
            throw new Error('Texture XML response is not text');
          this.pairs.xml(item.name, textLoader.data);
        }
      } catch {
        this.fail(item, bitmap);
        return;
      }
      this.settle(item);
    };
    const failed = () => {
      if (settled || this.cancelled) return;
      settled = true;
      detach();
      abort();
      if (attempt + 1 >= TextureManager.LOAD_ATTEMPTS) return this.fail(item);
      const retry = setTimeout(
        () => this.startItem(item, attempt + 1),
        TextureManager.RETRY_DELAY_MS * (attempt + 1),
      );
      item.cancel = () => clearTimeout(retry);
    };
    item.cancel = () => {
      settled = true;
      detach();
      abort();
    };
    target.addEventListener('progress', progress);
    target.addEventListener('complete', complete);
    target.addEventListener('ioError', failed);
    target.addEventListener('securityError', failed);
    timer = setTimeout(failed, TextureManager.LOAD_TIMEOUT_MS);
    let url = this.manager.textureUrl(item.name);
    if (attempt > 0) url += `${url.includes('?') ? '&' : '?'}retry=${attempt}`;
    try {
      const request = new URLRequest(url);
      if (imageLoader) imageLoader.load(request, new LoaderContext(true));
      else textLoader!.load(request);
    } catch (error) {
      if (settled) throw error;
      failed();
    }
  }

  private fail(item: Item, bitmap: Bitmap | null = null): void {
    if (this.cancelled || item.complete) return disposeTextureBitmap(bitmap);
    item.cancel = undefined;
    this.pairs.fail(item.name, bitmap);
    try {
      this.manager.dispatchEvent(new Event('preloadError', false, item.name));
    } finally {
      if (!this.cancelled) this.settle(item);
    }
  }

  private settle(item: Item): void {
    if (this.cancelled || item.complete) return;
    item.complete = true;
    item.fraction = 1;
    this.progress();
    if (!this.cancelled && this.items.every((entry) => entry.complete)) this.finish();
  }

  private progress(): void {
    if (this.cancelled || !this.items.length) return;
    const percent = Math.floor(
      (this.items.reduce((sum, item) => sum + item.fraction, 0) / this.items.length) * 100,
    );
    if (percent <= this.manager.pLoaded) return;
    this.manager.pLoaded = percent;
    this.manager.dispatchEvent(new Event('preloadProgress'));
  }

  private finish(): void {
    if (this.cancelled || this.completed) return;
    this.completed = true;
    this.manager.pLoaded = 100;
    this.manager.dispatchEvent(new Event('preloadProgress'));
    if (!this.cancelled) this.manager.dispatchEvent(new Event('preloadComplete'));
  }
}
