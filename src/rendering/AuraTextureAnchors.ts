import type { Raw } from '../api/Types';
import { AuraTextureSource, type AuraPoint } from './AuraTextureSource';

/** Original bounded four-neighbor interior coverage clouds for lightning endpoints. */
export class AuraTextureAnchors {
  private cached = new WeakMap<Raw, { revision: number; points: AuraPoint[][] }>();
  constructor(private source: AuraTextureSource) {}

  points(texture: Raw | null): AuraPoint[][] {
    if (!texture) return [];
    const revision = this.source.revision(texture);
    const cached = this.cached.get(texture);
    if (cached?.revision === revision) return cached.points;
    let points: AuraPoint[][] = [];
    try {
      points = this.build(texture);
    } catch {
      /* Disposed/custom bitmaps have no lightning. */
    }
    this.cached.set(texture, { revision, points });
    return points;
  }

  private build(texture: Raw): AuraPoint[][] {
    const mapping = this.source.mapping(texture);
    if (!mapping) return [];
    const { filled, columns, rows } = mapping;
    const opaque = filled.reduce((sum, value) => sum + value, 0);
    const samplingStep = Math.max(1, Math.ceil(opaque / 4096));
    const result: AuraPoint[][] = [];
    let total = 0;
    for (let seed = 0; seed < filled.length && result.length < 32 && total < 4096; seed++) {
      if (!filled[seed]) continue;
      const queue: number[] = [seed];
      const component: AuraPoint[] = [];
      filled[seed] = 0;
      const enqueue = (index: number): void => {
        if (filled[index]) {
          filled[index] = 0;
          queue.push(index);
        }
      };
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor],
          x = index % columns,
          y = Math.floor(index / columns);
        if (total < 4096 && (!component.length || cursor % samplingStep === 0)) {
          component.push(mapping.point((x + 0.5) / columns, (y + 0.5) / rows));
          total++;
        }
        if (x > 0) enqueue(index - 1);
        if (x + 1 < columns) enqueue(index + 1);
        if (y > 0) enqueue(index - columns);
        if (y + 1 < rows) enqueue(index + columns);
      }
      if (component.length) result.push(component);
    }
    return result;
  }
}
