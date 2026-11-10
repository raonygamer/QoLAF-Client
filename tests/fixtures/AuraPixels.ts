import { AuraTextureSource } from '../../src/rendering/AuraTextureSource';
import { AuraTextureAnchors } from '../../src/rendering/AuraTextureAnchors';

class Vertices {
  points: any = {};
  set_numVertices(_count: number) {}
  getPoint(index: number, key: string) {
    return this.points[key][index];
  }
}
export function auraPixels(width = 5, height = 5, rotated = false) {
  let reads = 0;
  const mask = Array.from({ length: height }, () => Array(width).fill(0));
  const bitmap = {
    width,
    height,
    getPixel32(x: number, y: number) {
      reads++;
      return mask[y][x] << 24;
    },
  };
  const root = { nativeWidth: width, nativeHeight: height };
  const texture = {
    root,
    width: rotated ? height : width,
    height: rotated ? width : height,
    setupTextureCoordinates(vertices: Vertices) {
      vertices.points.texCoords = rotated
        ? [
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 0 },
          ]
        : [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ];
    },
    setupVertexPositions(vertices: Vertices) {
      vertices.points.position = [
        { x: 0, y: 0 },
        { x: this.width, y: 0 },
        { x: 0, y: this.height },
      ];
    },
  };
  const source = new AuraTextureSource(Vertices);
  const anchors = new AuraTextureAnchors(source);
  source.register(texture, bitmap);
  return { source, anchors, texture, bitmap, mask, reads: () => reads };
}
