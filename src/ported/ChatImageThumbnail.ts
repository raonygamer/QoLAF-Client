import { bound, type Resolve } from '../runtime/As3';
import type { Raw } from '../api/Types';
import type { ChatImageCache } from '../chat/ChatImageCache';
import type { ChatImageAsset } from '../chat/ChatImageAsset';
import type { ChatDiscordImageLink } from '../chat/ChatDiscordImageLink';

/** Source ChatImageThumbnail, sharing the browser cache and the native frame clock. */
export function createChatImageThumbnail(
  resolve: Resolve,
  cache: ChatImageCache,
  now: () => number = () => performance.now(),
) {
  const Sprite = resolve('starling.display.Sprite');
  const Image = resolve('starling.display.Image');
  const TextField = resolve('starling.text.TextField');
  const TextFormat = resolve('starling.text.TextFormat');
  const Fonts = resolve('core.text.VerdanaBitmapFontRegistry');

  class ChatImageThumbnail extends Sprite {
    static readonly MAX_PREVIEW_WIDTH = 220;
    static readonly MAX_PREVIEW_HEIGHT = 140;
    static readonly LOADING_WIDTH = 92;
    static readonly LOADING_HEIGHT = 16;
    onPreviewSizeChanged: (() => void) | null = null;
    private status: Raw;
    private image: Raw | null = null;
    private asset: ChatImageAsset | null = null;
    private current: ChatDiscordImageLink | null = null;
    private generation = 0;
    private previewWidthValue = ChatImageThumbnail.LOADING_WIDTH;
    private previewHeightValue = ChatImageThumbnail.LOADING_HEIGHT;
    private animationFrame = 0;
    private nextFrameAt = 0;
    private disposed = false;

    constructor() {
      super();
      this.status = new TextField(
        1,
        1,
        '',
        new TextFormat(Fonts.fontNameForSize(10), 10, 0xb9c4d2, 'left', 'center'),
      );
      this.status.touchable = false;
      this.addChild(this.status);
      this.layoutPlaceholder();
    }

    get previewWidth(): number {
      return this.previewWidthValue;
    }
    get previewHeight(): number {
      return this.previewHeightValue;
    }
    get link(): ChatDiscordImageLink | null {
      return this.current;
    }
    set link(value: ChatDiscordImageLink | null) {
      if (
        this.disposed ||
        this.current === value ||
        (this.current && value && this.current.rawUrl === value.rawUrl)
      )
        return;
      this.generation++;
      this.stopAnimation();
      this.releaseAsset();
      this.current = value;
      if (this.image) this.image.visible = false;
      if (!value) {
        this.status.text = '';
        this.status.visible = false;
        return;
      }
      // Prime geometry before synchronous cache delivery; reopening Advanced
      // must not invalidate its virtualized layout from inside validation.
      const cached = cache.cachedSize(value);
      if (cached) this.setPreviewSizeForSource(cached.width, cached.height, false);
      else
        this.setPreviewSize(
          ChatImageThumbnail.LOADING_WIDTH,
          ChatImageThumbnail.LOADING_HEIGHT,
          false,
        );
      this.status.format.horizontalAlign = 'left';
      this.status.text = '[Image loading]';
      this.status.visible = true;
      const expected = this.generation;
      const expectedUrl = value.rawUrl;
      const stale = () =>
        this.disposed || expected !== this.generation || this.current?.rawUrl !== expectedUrl;
      cache.acquire(
        value,
        (asset) => {
          if (stale()) {
            cache.release(asset);
            return;
          }
          this.asset = asset;
          this.showAsset();
        },
        () => {
          if (stale()) return;
          this.showError();
        },
      );
    }

    private showError(): void {
      this.status.format.horizontalAlign = 'left';
      this.status.text = '[Image unavailable]';
      this.status.visible = true;
      this.setPreviewSize(110, 16, true);
    }

    private showAsset(): void {
      const asset = this.asset;
      if (!asset?.frames.length) {
        this.releaseAsset();
        this.showError();
        return;
      }
      if (!this.image) {
        this.image = new Image(asset.frames[0]);
        this.image!.touchable = false;
        this.addChildAt(this.image, 1);
      } else {
        this.image.texture = asset.frames[0];
        this.image.readjustSize();
      }
      const image = this.image!;
      image.scaleX = image.scaleY = this.previewScale(asset.width, asset.height);
      image.x = image.y = 0;
      image.visible = true;
      this.status.visible = false;
      this.animationFrame = 0;
      if (asset.animated) {
        this.nextFrameAt = now() + asset.delayAt(0);
        this.addEventListener('enterFrame', this.onAnimationFrame);
      }
      // Callback may synchronously recycle/dispose this node. Do nothing after it.
      this.setPreviewSizeForSource(asset.width, asset.height, true);
    }

    private previewScale(width: number, height: number): number {
      return width <= 0 || height <= 0
        ? 1
        : Math.min(
            ChatImageThumbnail.MAX_PREVIEW_WIDTH / width,
            ChatImageThumbnail.MAX_PREVIEW_HEIGHT / height,
            1,
          );
    }

    private setPreviewSizeForSource(width: number, height: number, notify: boolean): void {
      const scale = this.previewScale(width, height);
      this.setPreviewSize(Math.ceil(width * scale), Math.ceil(height * scale), notify);
    }

    @bound
    private onAnimationFrame(_event: Raw): void {
      const asset = this.asset;
      if (!asset?.animated || !this.image) return;
      const time = now();
      let guard = 0;
      while (time >= this.nextFrameAt && guard++ < asset.frames.length + 1) {
        this.animationFrame = (this.animationFrame + 1) % asset.frames.length;
        this.image.texture = asset.frames[this.animationFrame];
        this.nextFrameAt += asset.delayAt(this.animationFrame);
      }
    }

    private stopAnimation(): void {
      this.removeEventListener('enterFrame', this.onAnimationFrame);
      this.animationFrame = 0;
      this.nextFrameAt = 0;
    }

    private setPreviewSize(width: number, height: number, notify: boolean): void {
      width = Math.max(1, width);
      height = Math.max(1, height);
      if (this.previewWidthValue === width && this.previewHeightValue === height) return;
      this.previewWidthValue = width;
      this.previewHeightValue = height;
      this.layoutPlaceholder();
      if (notify) this.onPreviewSizeChanged?.();
    }

    private layoutPlaceholder(): void {
      this.status.x = this.status.y = 0;
      this.status.width = this.previewWidthValue;
      this.status.height = this.previewHeightValue;
    }

    private releaseAsset(): void {
      if (!this.asset) return;
      cache.release(this.asset);
      this.asset = null;
    }

    dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      this.generation++;
      this.stopAnimation();
      this.releaseAsset();
      this.current = null;
      this.onPreviewSizeChanged = null;
      this.image = null;
      super.dispose();
    }
  }
  return ChatImageThumbnail;
}
