import { read, type API, type Raw } from '../api/Types';

/** Session-owned procedural maps, shared by the individual bomb shells. */
export class RingDistortionTextures {
  private readonly textures = new Map<string, Raw>();

  constructor(private readonly api: API) {}

  get(width: number, height: number, radius: number, range: number): Raw {
    const key = `${width}|${height}|${radius}|${range}`;
    const existing = this.textures.get(key);
    if (existing) return existing;
    const bitmap = this.createBitmap(width, height, radius, range);
    const texture = this.api
      .cls('starling.textures.Texture')!
      .fromBitmapData(bitmap, false, false, 1);
    bitmap.dispose();
    const root = read(texture, 'root');
    root.set_onRestore(() => {
      const restored = this.createBitmap(width, height, radius, range);
      try {
        root.uploadBitmapData(restored);
      } finally {
        restored.dispose();
      }
    });
    this.textures.set(key, texture);
    return texture;
  }

  dispose(): void {
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }

  private createBitmap(width: number, height: number, radius: number, range: number): Raw {
    const bitmapWidth = Math.max(2, Math.ceil(width * (radius + range) * 2 + 8));
    const bitmapHeight = Math.max(2, Math.ceil(height * (radius + range) * 2 + 8));
    const BitmapData = this.api.cls('openfl.display.BitmapData') as any;
    const bitmap = new BitmapData(bitmapWidth, bitmapHeight, true, 0);
    const size = Math.min(width, height);
    const ringRadius = size * radius;
    const ringRange = Math.max(1, size * range);
    bitmap.lock();
    for (let y = 0; y < bitmapHeight; y++) {
      const dy = y + 0.5 - bitmapHeight * 0.5;
      for (let x = 0; x < bitmapWidth; x++) {
        const dx = x + 0.5 - bitmapWidth * 0.5;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const offset = (distance - ringRadius) / ringRange;
        if (Math.abs(offset) >= 1 || distance <= 0.001) continue;
        const bend = Math.sin(offset * Math.PI) * (1 - Math.abs(offset));
        const red = Math.max(0, Math.min(255, 128 + (dx / distance) * bend * 127));
        const green = Math.max(0, Math.min(255, 128 + (dy / distance) * bend * 127));
        bitmap.setPixel32(x, y, (0xff000080 | (red << 16) | (green << 8)) >>> 0);
      }
    }
    bitmap.unlock();
    return bitmap;
  }
}

/** Port of core.filters.RingDistortionSource; the center and exterior are transparent. */
export class RingDistortionSource {
  private disposed = false;
  readonly image: Raw;
  readonly strength: number;
  readonly ringRadius: number;
  readonly influenceRadius: number;
  effectiveStrength: number;

  constructor(
    api: API,
    textures: RingDistortionTextures,
    width: number,
    height: number,
    radius = 0.34,
    range = 0.22,
    strength = 20,
  ) {
    const Image = api.cls('starling.display.Image') as any;
    this.image = new Image(textures.get(width, height, radius, range));
    this.image.set_touchable(false);
    this.strength = this.effectiveStrength = Math.abs(strength);
    this.ringRadius = Math.min(width, height) * radius;
    this.influenceRadius = Math.min(width, height) * (radius + range);
  }

  centerAt(x: number, y: number, scaleX: number, scaleY: number, expansion = 1, fade = 1): void {
    this.image.set_scaleX(Math.abs(scaleX) * Math.max(0, expansion));
    this.image.set_scaleY(Math.abs(scaleY) * Math.max(0, expansion));
    this.image.set_x(x - read(this.image, 'width') * 0.5);
    this.image.set_y(y - read(this.image, 'height') * 0.5);
    this.effectiveStrength = this.strength * Math.max(0, fade);
  }

  prepareForRender(maximumStrength: number): void {
    this.image.set_alpha(Math.max(0, Math.min(1, this.effectiveStrength / maximumStrength)));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.image.dispose();
  }
}
