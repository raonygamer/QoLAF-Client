import type { Raw } from '../api/Types';
import { AuraTextureSource, type AuraPoint, type AuraTextureMapping } from './AuraTextureSource';

type Mapping = AuraTextureMapping & { validationBudget: number };

/** Source closed alpha contours, including holes and native-resolution gap validation. */
export class AuraTextureContours {
  private cached = new WeakMap<Raw, { revision: number; contours: AuraPoint[][] }>();
  constructor(private source: AuraTextureSource) {}

  contours(texture: Raw | null): AuraPoint[][] {
    if (!texture) return [];
    const revision = this.source.revision(texture);
    const cached = this.cached.get(texture);
    if (cached?.revision === revision) return cached.contours;
    let contours: AuraPoint[][] = [];
    try {
      contours = this.build(texture);
    } catch {
      /* Unreadable pixels have no outline. */
    }
    this.cached.set(texture, { revision, contours });
    return contours;
  }

  private build(texture: Raw): AuraPoint[][] {
    const coverage = this.source.mapping(texture);
    if (!coverage) return [];
    const mapping: Mapping = { ...coverage, validationBudget: 32768 };
    const { columns, rows, filled } = mapping;
    const stride = columns + 1;
    const edges = new Uint8Array(stride * (rows + 1));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        if (!filled[y * columns + x]) continue;
        if (!y || !filled[(y - 1) * columns + x]) edges[y * stride + x] |= 1;
        if (x === columns - 1 || !filled[y * columns + x + 1]) edges[y * stride + x + 1] |= 2;
        if (y === rows - 1 || !filled[(y + 1) * columns + x]) edges[(y + 1) * stride + x + 1] |= 4;
        if (!x || !filled[y * columns + x - 1]) edges[(y + 1) * stride + x] |= 8;
      }
    }
    const result: AuraPoint[][] = [];
    for (let index = 0; index < edges.length && result.length < 32; index++) {
      for (let direction = 0; direction < 4 && result.length < 32; direction++) {
        if (!(edges[index] & (1 << direction))) continue;
        const loop = this.traceLoop(edges, index, direction, stride, mapping);
        if (loop.length >= 4) result.push(loop);
      }
    }
    return result;
  }

  private traceLoop(
    edges: Uint8Array,
    start: number,
    direction: number,
    stride: number,
    mapping: Mapping,
  ): AuraPoint[] {
    const points: AuraPoint[] = [];
    const { columns, rows } = mapping;
    let index = start,
      steps = 0,
      overflow = false;
    const initialDirection = direction;
    while (steps++ < edges.length * 4) {
      edges[index] &= ~(1 << direction);
      const x = index % stride,
        y = Math.floor(index / stride);
      const dx = direction === 0 ? 1 : direction === 2 ? -1 : 0;
      const dy = direction === 1 ? 1 : direction === 3 ? -1 : 0;
      if (points.length < 768) {
        // Inset into the occupied owner cell; retreat to its center if needed.
        let u = (x + dx * 0.5 - dy * 0.22) / columns;
        let v = (y + dy * 0.5 + dx * 0.22) / rows;
        if (!mapping.covered(u, v)) {
          u = (x + dx * 0.5 - dy * 0.5) / columns;
          v = (y + dy * 0.5 + dx * 0.5) / rows;
        }
        points.push(mapping.point(u, v));
      } else overflow = true;
      index += dx + dy * stride;
      if (index < 0 || index >= edges.length) break;
      const closing = index === start;
      const next = closing ? initialDirection : this.nextDirection(edges[index], direction);
      if (next < 0) break;
      if (next === (direction + 3) % 4) {
        // Visit the third occupied cell at concave turns, avoiding a diagonal shortcut.
        const nextDx = next === 0 ? 1 : next === 2 ? -1 : 0;
        const nextDy = next === 1 ? 1 : next === 3 ? -1 : 0;
        const u = ((index % stride) - (dy + nextDy) * 0.5) / columns;
        const v = (Math.floor(index / stride) + (dx + nextDx) * 0.5) / rows;
        if (points.length < 768 && mapping.covered(u, v)) points.push(mapping.point(u, v));
        else overflow = true;
      }
      if (closing) return !overflow && this.coveredLoop(points, mapping) ? points : [];
      direction = next;
    }
    return []; // Never close an open or truncated path across transparent space.
  }

  private coveredLoop(points: AuraPoint[], mapping: Mapping): boolean {
    if (points.length < 4) return false;
    for (let index = 0; index < points.length; index++) {
      const a = mapping.uv(points[index]),
        b = mapping.uv(points[(index + 1) % points.length]);
      if (!a || !b) return false;
      const du = b.x - a.x,
        dv = b.y - a.y;
      const pixels = mapping.pixelDelta(du, dv);
      const samples = Math.max(2, Math.ceil(Math.max(Math.abs(pixels.x), Math.abs(pixels.y)) * 2));
      if (samples > 64 || mapping.validationBudget < samples) return false;
      mapping.validationBudget -= samples;
      for (let step = 0; step < samples; step++) {
        if (!mapping.covered(a.x + (du * step) / samples, a.y + (dv * step) / samples))
          return false;
      }
    }
    return true;
  }

  private nextDirection(mask: number, previous: number): number {
    const right = (previous + 1) % 4;
    if (mask & (1 << right)) return right;
    if (mask & (1 << previous)) return previous;
    const left = (previous + 3) % 4;
    if (mask & (1 << left)) return left;
    const back = (previous + 2) % 4;
    return mask & (1 << back) ? back : -1;
  }
}
