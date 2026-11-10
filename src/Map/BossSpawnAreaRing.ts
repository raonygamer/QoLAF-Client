import type { Raw } from '../Api/Types';
import { NativeUI } from '../UI/NativeUI';

/** Original cached 96-segment dashed outline, with no textures or filters. */
export class BossSpawnAreaRing {
  readonly node: Raw;
  private lastRadius = -1;
  private lastThickness = -1;

  constructor(ui: NativeUI, tint: number) {
    const vertices = new (ui.cls('starling.rendering.VertexData'))();
    const indices = new (ui.cls('starling.rendering.IndexData'))();
    vertices.set_numVertices(96 * 4);
    for (let i = 0; i < 96; i++) {
      const first = i * 4;
      indices.addQuad(first, first + 1, first + 2, first + 3);
    }
    this.node = new (ui.cls('starling.display.Mesh'))(vertices, indices);
    this.node.set_color(tint);
    this.node.set_alpha(0.35);
    this.node.set_touchable(false);
  }

  setGeometry(radius: number, thickness: number): void {
    if (radius === this.lastRadius && thickness === this.lastThickness) return;
    this.lastRadius = radius;
    this.lastThickness = thickness;
    const inner = Math.max(0, radius - thickness / 2),
      outer = radius + thickness / 2;
    for (let i = 0; i < 96; i++) {
      const angle = (i * Math.PI * 2) / 96,
        end = ((i + 0.65) * Math.PI * 2) / 96,
        first = i * 4;
      this.node.setVertexPosition(first, Math.cos(angle) * inner, Math.sin(angle) * inner);
      this.node.setVertexPosition(first + 1, Math.cos(angle) * outer, Math.sin(angle) * outer);
      this.node.setVertexPosition(first + 2, Math.cos(end) * inner, Math.sin(end) * inner);
      this.node.setVertexPosition(first + 3, Math.cos(end) * outer, Math.sin(end) * outer);
    }
  }
}
