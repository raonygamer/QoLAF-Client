import type { API } from '../api/Types';
import type { AuraPoint } from './AuraTextureSource';
interface Arc {
  waitMs: number;
  remainingMs: number;
  startPoint: AuraPoint | null;
  endPoint: AuraPoint | null;
  bend: number;
  direction: number;
  seed: number;
  opacity: number;
}
const SEGMENTS = 14;
const BURST_MS = 720;

/** Original AuraLightning mesh and burst timing, backed by native Starling geometry. */
export function createAuraLightning(api: API): any {
  const Mesh = api.cls('starling.display.Mesh') as any;
  const VertexData = api.cls('starling.rendering.VertexData') as any;
  const IndexData = api.cls('starling.rendering.IndexData') as any;
  class AuraLightning extends Mesh {
    private arcs: Arc[] = [];
    private sourceAnchors: AuraPoint[][] | null = null;
    private anchorGroups: AuraPoint[][] = [];
    private totalPoints = 0;
    private startGapMs = 0;
    private lastColor = 0;
    private arcCount = 0;
    private released = false;
    constructor() {
      super(new VertexData(), new IndexData());
      this.set_touchable(false);
      this.set_visible(false);
      this.set_blendMode('add');
      this.configureCount(8);
    }

    setAnchors(anchors: AuraPoint[][] | null): void {
      if (this.released || anchors === this.sourceAnchors) return;
      this.sourceAnchors = anchors;
      this.anchorGroups.length = 0;
      this.totalPoints = 0;
      this.set_visible(false);
      this.startGapMs = 0;
      for (let arc = 0; arc < this.arcs.length; arc++) {
        this.arcs[arc].remainingMs = 0;
        this.arcs[arc].opacity = 0;
        this.arcs[arc].startPoint = this.arcs[arc].endPoint = null;
        this.tintArc(arc, this.lastColor, 0);
      }
      if (anchors != null) {
        for (let index = 0; index < Math.min(32, anchors.length); index++) {
          const cloud: any = anchors[index];
          if (cloud == null || !Array.isArray(cloud) || cloud.length < 2 || cloud.length > 4096)
            continue;
          let points: AuraPoint[] = [];
          for (const point of cloud) {
            if (
              point != null &&
              Number.isFinite(point.x) &&
              Number.isFinite(point.y) &&
              Math.abs(point.x) <= 4 &&
              Math.abs(point.y) <= 4
            )
              points.push(point);
          }
          if (points.length < 2 || this.totalPoints + points.length > 4096) continue;
          this.anchorGroups.push(points);
          this.totalPoints += points.length;
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
          startPoint: null,
          endPoint: null,
          bend: 0,
          direction: 1,
          seed: 0,
          opacity: 0,
        });
      }
      this.arcs.length = count;
      for (let i = 0; i < count; i++) this.tintArc(i, this.lastColor, 0);
      this.setIndexDataChanged();
      this.setVertexDataChanged();
    }

    advance(
      elapsed: number,
      radiusX: number,
      radiusY: number,
      color: number,
      count = 8,
      frequency = 3,
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
        this.anchorGroups.length == 0
      )
        return;
      count = Math.max(0, Math.min(8, count));
      if (count == 0) return;
      frequency = Number.isFinite(frequency) ? Math.max(0.25, Math.min(3, frequency)) : 3;
      frequency *= Number.isFinite(frequencyScale)
        ? Math.max(0.05, Math.min(1, frequencyScale))
        : 1;
      if (count != this.arcCount) this.configureCount(count);
      elapsed = Math.max(0, Math.min(500, elapsed));
      this.startGapMs = Math.max(0, this.startGapMs - elapsed);
      let changed = false;
      this.set_alpha(1);
      for (let arc = 0; arc < this.arcCount; arc++) {
        let state: Arc = this.arcs[arc];
        const previousOpacity = state.opacity;
        if (state.remainingMs <= 0) {
          state.waitMs = Math.max(0, state.waitMs - elapsed * frequency);
          if (state.waitMs <= 0 && this.startGapMs <= 0) {
            this.startBurst(state, radiusX, radiusY);
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
        if (state.remainingMs > 0 && state.startPoint != null && state.endPoint != null) {
          this.rebuildArc(arc, state, radiusX, radiusY, color, age);
          changed = true;
        } else if (state.opacity != previousOpacity) {
          this.tintArc(arc, color, state.opacity);
          changed = true;
        }
        if (state.opacity > 0) this.set_visible(true);
      }
      this.lastColor = color;
      if (changed) this.setVertexDataChanged();
    }

    private startBurst(state: Arc, radiusX: number, radiusY: number): void {
      let pick = Math.floor(Math.random() * this.totalPoints);
      let points: AuraPoint[] = this.anchorGroups[this.anchorGroups.length - 1];
      for (const group of this.anchorGroups) {
        pick -= group.length;
        if (pick < 0) {
          points = group;
          break;
        }
      }
      let start: AuraPoint | null = points[Math.floor(Math.random() * points.length)];
      let end: AuraPoint | null = null;
      let bestDistance = 0;
      const minimum = Math.max(3, Math.min(radiusX, radiusY) * 0.28);
      // Bounded selection even on very narrow or nearly empty sprites.
      // Only the endpoints are constrained; the jagged bridge is free to arc.
      for (let i = 0; i < 24; i++) {
        const candidate: AuraPoint | null = points[Math.floor(Math.random() * points.length)];
        const dx = (candidate.x - start.x) * radiusX;
        const dy = (candidate.y - start.y) * radiusY;
        const distance = dx * dx + dy * dy;
        if (distance > bestDistance) {
          end = candidate;
          bestDistance = distance;
        }
        if (distance >= minimum * minimum) break;
      }
      state.waitMs = 1800 + Math.random() * 1800;
      if (end == null || bestDistance < 1) return;
      state.startPoint = start;
      state.endPoint = end;
      state.remainingMs = BURST_MS;
      state.bend = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.2);
      state.direction = Math.random() < 0.5 ? -1 : 1;
      state.seed = Math.random() * 1000;
    }

    private smoothStep(value: number): number {
      value = Math.max(0, Math.min(1, value));
      return value * value * (3 - 2 * value);
    }

    private rebuildArc(
      arc: number,
      state: Arc,
      radiusX: number,
      radiusY: number,
      color: number,
      age: number,
    ): void {
      let start: AuraPoint | null = state.startPoint!;
      let end: AuraPoint | null = state.endPoint!;
      let x0 = start.x * radiusX;
      let y0 = start.y * radiusY;
      const dx = (end.x - start.x) * radiusX;
      const dy = (end.y - start.y) * radiusY;
      const length = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      const nx = -dy / length;
      const ny = dx / length;
      const width = Math.max(0.65, Math.min(1.25, Math.min(radiusX, radiusY) / 35));
      const jitter = Math.min(9, length * 0.18);
      const bow = Math.min(22, length * Math.abs(state.bend)) * (state.bend < 0 ? -1 : 1);
      const phase = age / BURST_MS;
      let previousX = x0;
      let previousY = y0;
      for (let i = 1; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const envelope = Math.sin(t * Math.PI);
        // A stable jagged spine plus a traveling kink. The middle climbs
        // the bowed bridge while the two covered anchors stay attached.
        const hash = Math.sin(state.seed + i * 43.17) * 43758.5453;
        const noise = (hash - Math.floor(hash)) * 2 - 1;
        const moving = Math.sin(t * 12 - state.direction * phase * 9 + state.seed);
        const offset =
          i == SEGMENTS
            ? 0
            : envelope *
              (bow * (0.8 + 0.2 * Math.sin(phase * Math.PI)) +
                jitter * (noise * 0.72 + moving * 0.28));
        const nextX = x0 + dx * t + nx * offset;
        const nextY = y0 + dy * t + ny * offset;
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
      this.sourceAnchors = null;
      this.anchorGroups.length = 0;
      this.totalPoints = 0;
      super.dispose();
    }
  }
  Object.assign(AuraLightning, { __name__: 'qolaf.rendering.AuraLightning', __super__: Mesh });
  AuraLightning.prototype.__class__ = AuraLightning;
  return AuraLightning;
}
