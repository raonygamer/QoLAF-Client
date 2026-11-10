import type { API } from '../api/Types';
import type { AuraPoint } from './AuraTextureSource';
interface Arc {
  waitMs: number;
  remainingMs: number;
  path: Path | null;
  start: number;
  span: number;
  travel: number;
  direction: number;
  seed: number;
  opacity: number;
}
interface Path {
  points: AuraPoint[];
  lengths: number[];
  length: number;
}
const SEGMENTS = 14;
const BURST_MS = 720;

/** Original AuraOutlineLightning mesh and burst timing, backed by native Starling geometry. */
export function createAuraOutlineLightning(api: API): any {
  const Mesh = api.cls('starling.display.Mesh') as any;
  const VertexData = api.cls('starling.rendering.VertexData') as any;
  const IndexData = api.cls('starling.rendering.IndexData') as any;
  class AuraOutlineLightning extends Mesh {
    private arcs: Arc[] = [];
    private sourceContours: AuraPoint[][] | null = null;
    private paths: Path[] = [];
    private totalLength = 0;
    private samplePoint: AuraPoint | null = { x: 0, y: 0 };
    private startGapMs = 0;
    private lastColor = 0;
    private arcCount = 0;
    private released = false;
    constructor() {
      super(new VertexData(), new IndexData());
      this.set_touchable(false);
      this.set_visible(false);
      this.set_blendMode('add');
      this.configureCount(4);
    }

    setContours(contours: AuraPoint[][] | null): void {
      if (this.released || contours === this.sourceContours) return;
      this.sourceContours = contours;
      this.paths.length = 0;
      this.totalLength = 0;
      // A new sprite/texture must not inherit a bolt on its previous shape.
      this.set_visible(false);
      this.startGapMs = 0;
      for (let arc = 0; arc < this.arcs.length; arc++) {
        this.arcs[arc].remainingMs = 0;
        this.arcs[arc].opacity = 0;
        this.arcs[arc].path = null;
        this.tintArc(arc, this.lastColor, 0);
      }
      if (contours != null) {
        for (let index = 0; index < Math.min(64, contours.length); index++) {
          const loop: any = contours[index];
          if (loop == null || !Array.isArray(loop) || loop.length < 3 || loop.length > 4096)
            continue;
          const points: AuraPoint[] = [];
          let valid = true;
          for (const point of loop) {
            if (
              point == null ||
              !Number.isFinite(point.x) ||
              !Number.isFinite(point.y) ||
              Math.abs(point.x) > 4 ||
              Math.abs(point.y) > 4
            ) {
              valid = false;
              break;
            }
            const previous: AuraPoint | null =
              points.length == 0 ? null : points[points.length - 1];
            if (previous == null || point.x != previous.x || point.y != previous.y)
              points.push(point);
          }
          if (!valid || points.length < 3) continue;
          if (
            points[0].x == points[points.length - 1].x &&
            points[0].y == points[points.length - 1].y
          )
            points.pop();
          if (points.length < 3) continue;
          const lengths: number[] = [];
          lengths.push(0);
          let perimeter = 0;
          let area = 0;
          for (let i = 0; i < points.length; i++) {
            const a: AuraPoint | null = points[i];
            const b: AuraPoint | null = points[(i + 1) % points.length];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            perimeter += Math.sqrt(dx * dx + dy * dy);
            area += a.x * b.y - b.x * a.y;
            lengths.push(perimeter);
          }
          if (!Number.isFinite(perimeter) || perimeter <= 0.000001 || Math.abs(area) <= 0.000001)
            continue;
          this.paths.push({ points: points, lengths: lengths, length: perimeter });
          this.totalLength += perimeter;
        }
      }
      this.setVertexDataChanged();
    }

    private configureCount(count: number): void {
      this.arcCount = count;
      this.get_vertexData().set_numVertices(SEGMENTS * count * 2 * 4);
      this.get_indexData().set_numIndices(0);
      for (let i = 0; i < this.get_vertexData().get_numVertices(); i += 4) {
        this.get_indexData().addQuad(i, i + 1, i + 2, i + 3);
      }
      while (this.arcs.length < count) {
        this.arcs.push({
          waitMs: 650 + Math.random() * 1800 + this.arcs.length * 90,
          remainingMs: 0,
          path: null,
          start: 0,
          span: 0,
          travel: 0,
          direction: 1,
          seed: 0,
          opacity: 0,
        });
      }
      this.arcs.length = count;
      for (let i = 0; i < count; i++) {
        this.tintArc(i, this.lastColor, 0);
      }
      this.setIndexDataChanged();
      this.setVertexDataChanged();
    }

    advance(
      elapsed: number,
      radiusX: number,
      radiusY: number,
      color: number,
      count = 4,
      frequency = 1,
      frequencyScale = 1,
    ): void {
      if (this.released) return;
      this.set_visible(false);
      if (
        !Number.isFinite(elapsed) ||
        !Number.isFinite(radiusX) ||
        !Number.isFinite(radiusY) ||
        radiusX <= 0 ||
        radiusY <= 0 ||
        this.paths.length == 0
      )
        return;
      count = Math.max(0, Math.min(8, count));
      if (count == 0) return;
      frequency = Number.isFinite(frequency) ? Math.max(0.25, Math.min(3, frequency)) : 1;
      // Per-aura rarity modifies the quiet gaps after the base frequency
      // clamp. The traveling/fading burst duration stays unchanged.
      frequency *= Number.isFinite(frequencyScale)
        ? Math.max(0.001, Math.min(1, frequencyScale))
        : 1;
      if (count != this.arcCount) this.configureCount(count);
      elapsed = Math.max(0, Math.min(500, elapsed));
      this.startGapMs = Math.max(0, this.startGapMs - elapsed);
      let changed = false;
      // Each arc has its own quiet gap, path, phase and fade. A short global
      // start gap also prevents a slow frame from firing every overdue arc.
      this.set_alpha(1);
      for (let arc = 0; arc < this.arcCount; arc++) {
        let state: Arc = this.arcs[arc];
        const previousOpacity = state.opacity;
        if (state.remainingMs <= 0) {
          state.waitMs = Math.max(0, state.waitMs - elapsed * frequency);
          if (state.waitMs <= 0 && this.startGapMs <= 0) {
            this.startBurst(state, frequency);
            this.startGapMs = 70 + Math.random() * 110;
          }
        } else {
          state.remainingMs = Math.max(0, state.remainingMs - elapsed);
        }
        const age = BURST_MS - state.remainingMs;
        state.opacity =
          state.remainingMs <= 0
            ? 0
            : this.smoothStep(age / 160) *
              this.smoothStep(state.remainingMs / 240) *
              (0.94 + 0.06 * Math.sin(age * 0.018 + state.seed));
        if (state.remainingMs > 0 && state.path != null) {
          // The bolt follows the moving contour every rendered frame;
          // there is no 45ms geometry jump or independent ellipse.
          this.rebuildArc(arc, state, radiusX, radiusY, color, age);
          changed = true;
        } else if (
          state.opacity != previousOpacity ||
          (state.opacity > 0 && color != this.lastColor)
        ) {
          this.tintArc(arc, color, state.opacity);
          changed = true;
        }
        if (state.opacity > 0) this.set_visible(true);
      }
      this.lastColor = color;
      if (changed) this.setVertexDataChanged();
    }

    private startBurst(state: Arc, frequency: number): void {
      let pick = Math.random() * this.totalLength;
      let path: Path = this.paths[this.paths.length - 1];
      for (const candidate of this.paths) {
        pick -= candidate.length;
        if (pick <= 0) {
          path = candidate;
          break;
        }
      }
      state.remainingMs = BURST_MS;
      // frequency already includes /16. Account for the unchanged active
      // burst too, so complete start-to-start cycles (not just gaps) are
      // 16x longer without slowing travel or stretching the fade.
      state.waitMs = 1800 + Math.random() * 1800 + BURST_MS * 15 * frequency;
      state.path = path;
      state.start = Math.random();
      state.span = 0.1 + Math.random() * 0.15;
      state.travel = 0.18 + Math.random() * 0.2;
      state.direction = Math.random() < 0.5 ? -1 : 1;
      state.seed = Math.random() * 1000;
    }

    private smoothStep(value: number): number {
      value = Math.max(0, Math.min(1, value));
      return value * value * (3 - 2 * value);
    }

    private sampleContour(path: Path, fraction: number, output: AuraPoint): number {
      const distance = (fraction - Math.floor(fraction)) * path.length;
      const lengths: number[] = path.lengths;
      const points: AuraPoint[] = path.points;
      let low = 0;
      let high = points.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (lengths[middle] <= distance) low = middle;
        else high = middle - 1;
      }
      const a: AuraPoint | null = points[low];
      const b: AuraPoint | null = points[(low + 1) % points.length];
      const span = lengths[low + 1] - lengths[low];
      const t = span <= 0 ? 0 : (distance - lengths[low]) / span;
      output.x = a.x + (b.x - a.x) * t;
      output.y = a.y + (b.y - a.y) * t;
      return low;
    }

    private rebuildArc(
      arc: number,
      state: Arc,
      radiusX: number,
      radiusY: number,
      color: number,
      age: number,
    ): void {
      const jitter = Math.min(2.5, Math.min(radiusX, radiusY) * 0.065);
      const width = Math.max(0.65, Math.min(1.25, Math.min(radiusX, radiusY) / 35));
      let path: Path = state.path!;
      const points: AuraPoint[] = path.points;
      const begin = state.start + state.direction * state.travel * (age / BURST_MS);
      this.sampleContour(path, begin, this.samplePoint!);
      let previousX = this.samplePoint!.x * radiusX;
      let previousY = this.samplePoint!.y * radiusY;
      for (let i = 1; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const edge = this.sampleContour(
          path,
          begin + state.direction * state.span * t,
          this.samplePoint!,
        );
        const a: AuraPoint | null = points[edge];
        const b: AuraPoint | null = points[(edge + 1) % points.length];
        const dx = (b.x - a.x) * radiusX;
        const dy = (b.y - a.y) * radiusY;
        const length = Math.max(0.000001, Math.sqrt(dx * dx + dy * dy));
        const noise =
          (Math.sin(state.seed + i * 2.399 + age * 0.016) +
            0.35 * Math.sin(state.seed * 0.53 + i * 5.1 - age * 0.01)) /
          1.35;
        // Both attachment points are exact contour samples. Only the
        // middle of the bolt lifts slightly off the actual aura border.
        const offset = i == SEGMENTS ? 0 : noise * jitter * Math.sin(t * Math.PI);
        const nextX = this.samplePoint!.x * radiusX - (dy / length) * offset;
        const nextY = this.samplePoint!.y * radiusY + (dx / length) * offset;
        const base = (arc * SEGMENTS + i - 1) * 8;
        this.segment(
          base,
          previousX,
          previousY,
          nextX,
          nextY,
          width * 3,
          color,
          0.14 * state.opacity,
        );
        this.segment(
          base + 4,
          previousX,
          previousY,
          nextX,
          nextY,
          width,
          color,
          0.9 * state.opacity,
        );
        previousX = nextX;
        previousY = nextY;
      }
    }

    private tintArc(arc: number, color: number, opacity: number): void {
      for (let i = 0; i < SEGMENTS; i++) {
        const base = (arc * SEGMENTS + i) * 8;
        this.get_vertexData().colorize('color', color, 0.14 * opacity, base, 4);
        this.get_vertexData().colorize('color', color, 0.9 * opacity, base + 4, 4);
      }
    }

    private segment(
      index: number,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      width: number,
      color: number,
      opacity: number,
    ): void {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      const nx = (-dy / length) * width * 0.5;
      const ny = (dx / length) * width * 0.5;
      this.get_vertexData().setPoint(index, 'position', x0 - nx, y0 - ny);
      this.get_vertexData().setPoint(index + 1, 'position', x0 + nx, y0 + ny);
      this.get_vertexData().setPoint(index + 2, 'position', x1 - nx, y1 - ny);
      this.get_vertexData().setPoint(index + 3, 'position', x1 + nx, y1 + ny);
      this.get_vertexData().colorize('color', color, opacity, index, 4);
    }

    dispose(): void {
      if (this.released) return;
      this.released = true;
      this.set_visible(false);
      this.arcs.length = 0;
      this.sourceContours = null;
      this.paths.length = 0;
      this.totalLength = 0;
      this.samplePoint = null;
      super.dispose();
    }
  }
  Object.assign(AuraOutlineLightning, {
    __name__: 'qolaf.rendering.AuraOutlineLightning',
    __super__: Mesh,
  });
  AuraOutlineLightning.prototype.__class__ = AuraOutlineLightning;
  return AuraOutlineLightning;
}
