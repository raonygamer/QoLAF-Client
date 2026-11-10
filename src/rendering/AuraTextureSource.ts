import { read, type API, type Raw } from '../api/Types';

export interface AuraPoint {
  x: number;
  y: number;
}
export interface AuraTextureMapping {
  width: number;
  height: number;
  columns: number;
  rows: number;
  filled: Uint8Array;
  point(u: number, v: number): AuraPoint;
  uv(point: AuraPoint): AuraPoint | null;
  pixelDelta(u: number, v: number): AuraPoint;
  covered(u: number, v: number): boolean;
}

/** Borrow upload bitmaps already retained by Starling; never read back the GPU. */
export class AuraTextureSource {
  private bitmaps = new WeakMap<Raw, Raw>();
  private revisions = new WeakMap<Raw, number>();
  constructor(private VertexData: any) {}

  register(texture: Raw, bitmap: Raw): void {
    const root = read(texture, 'root', texture);
    this.unregister(root);
    if (bitmap) this.bitmaps.set(root, bitmap);
  }
  unregister(texture: Raw): void {
    const root = read(texture, 'root', texture);
    this.bitmaps.delete(root);
    this.revisions.set(root, (this.revisions.get(root) ?? 0) + 1);
  }
  revision(texture: Raw): number {
    return this.revisions.get(read(texture, 'root', texture)) ?? 0;
  }
  mapping(texture: Raw): AuraTextureMapping | null {
    const root = read(texture, 'root', texture);
    const bitmap = this.bitmaps.get(root);
    const width = read(texture, 'width'),
      height = read(texture, 'height');
    if (!bitmap || !(width > 0) || !(height > 0)) return null;
    const bitmapWidth = read(bitmap, 'width'),
      bitmapHeight = read(bitmap, 'height');
    if (!(bitmapWidth > 0) || !(bitmapHeight > 0)) return null;
    const vertices = new this.VertexData();
    vertices.set_numVertices(4);
    texture.setupTextureCoordinates(vertices);
    texture.setupVertexPositions(vertices);
    const uv0 = vertices.getPoint(0, 'texCoords'),
      uv1 = vertices.getPoint(1, 'texCoords'),
      uv2 = vertices.getPoint(2, 'texCoords');
    const p0 = vertices.getPoint(0, 'position'),
      p1 = vertices.getPoint(1, 'position'),
      p2 = vertices.getPoint(2, 'position');
    const nativeWidth = read(root, 'nativeWidth'),
      nativeHeight = read(root, 'nativeHeight');
    const nativeX = Math.hypot((uv1.x - uv0.x) * nativeWidth, (uv1.y - uv0.y) * nativeHeight);
    const nativeY = Math.hypot((uv2.x - uv0.x) * nativeWidth, (uv2.y - uv0.y) * nativeHeight);
    if (!Number.isFinite(nativeX) || !Number.isFinite(nativeY) || nativeX <= 0 || nativeY <= 0)
      return null;
    const resolution = Math.min(1, 96 / Math.max(nativeX, nativeY));
    const columns = Math.max(1, Math.ceil(nativeX * resolution)),
      rows = Math.max(1, Math.ceil(nativeY * resolution));
    const covered = (u: number, v: number): boolean => {
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
      const x = Math.floor((uv0.x + (uv1.x - uv0.x) * u + (uv2.x - uv0.x) * v) * nativeWidth);
      const y = Math.floor((uv0.y + (uv1.y - uv0.y) * u + (uv2.y - uv0.y) * v) * nativeHeight);
      return (
        x >= 0 &&
        y >= 0 &&
        x < bitmapWidth &&
        y < bitmapHeight &&
        bitmap.getPixel32(x, y) >>> 24 >= 48
      );
    };
    const filled = new Uint8Array(columns * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        if (covered((x + 0.5) / columns, (y + 0.5) / rows)) filled[y * columns + x] = 1;
      }
    }
    return {
      width,
      height,
      columns,
      rows,
      filled,
      covered,
      uv: (point) => {
        const xx = p1.x - p0.x,
          xy = p2.x - p0.x,
          yx = p1.y - p0.y,
          yy = p2.y - p0.y;
        const determinant = xx * yy - xy * yx;
        if (!Number.isFinite(determinant) || determinant === 0) return null;
        const x = ((point.x + 1) * width) / 2 - p0.x,
          y = ((point.y + 1) * height) / 2 - p0.y;
        return { x: (x * yy - y * xy) / determinant, y: (y * xx - x * yx) / determinant };
      },
      pixelDelta: (u, v) => ({
        x: ((uv1.x - uv0.x) * u + (uv2.x - uv0.x) * v) * nativeWidth,
        y: ((uv1.y - uv0.y) * u + (uv2.y - uv0.y) * v) * nativeHeight,
      }),
      point: (u, v) => ({
        x: (p0.x + (p1.x - p0.x) * u + (p2.x - p0.x) * v - width / 2) / (width / 2),
        y: (p0.y + (p1.y - p0.y) * u + (p2.y - p0.y) * v - height / 2) / (height / 2),
      }),
    };
  }
}

export function installAuraTextureSource(api: API): AuraTextureSource | undefined {
  const VertexData = api.cls('starling.rendering.VertexData');
  if (!VertexData) return;
  const source = new AuraTextureSource(VertexData);
  for (const name of [
    'starling.textures.ConcretePotTexture',
    'starling.textures.ConcreteRectangleTexture',
  ]) {
    const prototype = api.cls(name)?.prototype;
    if (typeof prototype?.uploadBitmapData === 'function') {
      api.after(prototype, 'uploadBitmapData', function (_result, bitmap: Raw) {
        source.register(this, bitmap);
      });
    }
  }
  const concrete = api.cls('starling.textures.ConcreteTexture')?.prototype;
  if (typeof concrete?.dispose === 'function') {
    api.before(concrete, 'dispose', function () {
      source.unregister(this);
    });
  }
  return source;
}
