import type { API, Raw } from '../api/Types';

/** Original world-space rings, with screen-constant outline width. */
export class XhersixTorpedoCueView {
  readonly node: Raw;
  private readonly fixedRing: Raw;
  private readonly countdownRing: Raw;
  private readonly pulseRing: Raw;
  private readonly directions = Array.from({ length: 65 }, (_, i) => ({
    x: Math.cos((i * Math.PI * 2) / 64),
    y: Math.sin((i * Math.PI * 2) / 64),
  }));
  private lastInner = -1;
  private lastZoom = -1;
  constructor(api: API) {
    const Sprite = api.cls('starling.display.Sprite') as any;
    const Mesh = api.cls('starling.display.Mesh') as any;
    const VertexData = api.cls('starling.rendering.VertexData') as any;
    const IndexData = api.cls('starling.rendering.IndexData') as any;
    this.node = new Sprite();
    this.node.set_touchable(false);
    this.node.set_visible(false);
    const ring = (color: number, alpha: number) => {
      const vertices = new VertexData(),
        indices = new IndexData();
      vertices.set_numVertices(130);
      for (let i = 1; i <= 64; i++) indices.addQuad(i * 2 - 2, i * 2 - 1, i * 2, i * 2 + 1);
      const mesh = new Mesh(vertices, indices);
      mesh.set_color(color);
      mesh.set_alpha(alpha);
      mesh.set_touchable(false);
      this.node.addChild(mesh);
      return mesh;
    };
    this.fixedRing = ring(0xff4040, 0.55);
    this.countdownRing = ring(0xff4040, 0.85);
    this.pulseRing = ring(0xffdc55, 0.9);
    this.pulseRing.set_visible(false);
  }
  updateCue(
    x: number,
    y: number,
    bodyRadius: number,
    phaseMs: number,
    cycle: number,
    zoom = 1,
    pulseAgeMs = NaN,
  ): void {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > 1e7 ||
      Math.abs(y) > 1e7 ||
      !Number.isFinite(bodyRadius) ||
      bodyRadius < 0 ||
      bodyRadius > 10000 ||
      !Number.isFinite(phaseMs) ||
      phaseMs < 0 ||
      phaseMs > 2500 ||
      !Number.isInteger(cycle) ||
      cycle < 0 ||
      cycle > 1e9 ||
      !Number.isFinite(zoom) ||
      zoom < 0.025 ||
      zoom > 100
    ) {
      this.node.set_visible(false);
      return;
    }
    this.node.set_x(x);
    this.node.set_y(y);
    const inner = Math.max(40, bodyRadius + 18),
      stroke = 1 / zoom;
    if (inner !== this.lastInner || zoom !== this.lastZoom) {
      this.setRadius(this.fixedRing, inner, stroke);
      this.lastInner = inner;
      this.lastZoom = zoom;
    }
    this.setRadius(this.countdownRing, inner + 300 * (1 - phaseMs / 2500), stroke);
    if (Number.isNaN(pulseAgeMs)) pulseAgeMs = phaseMs;
    const pulse = cycle >= 1 && Number.isFinite(pulseAgeMs) && pulseAgeMs >= 0 && pulseAgeMs < 600;
    this.pulseRing.set_visible(pulse);
    if (pulse) {
      const progress = pulseAgeMs / 600;
      this.setRadius(this.pulseRing, inner + 300 * progress, stroke);
      this.pulseRing.set_alpha(0.9 * (1 - progress));
    }
    this.node.set_visible(true);
  }
  private setRadius(ring: Raw, radius: number, halfStroke: number): void {
    const inside = Math.max(0, radius - halfStroke),
      outside = radius + halfStroke;
    for (let i = 0; i <= 64; i++) {
      const direction = this.directions[i];
      ring.setVertexPosition(i * 2, direction.x * outside, direction.y * outside);
      ring.setVertexPosition(i * 2 + 1, direction.x * inside, direction.y * inside);
    }
  }
  dispose(): void {
    this.node.removeFromParent(true);
  }
}
