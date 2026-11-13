import type { Mesh } from '../game/Bindings';
import { NativeUI } from '../ui/NativeUI';
import { BossSpawnLocation, spawnIntersects, type SpawnViewport } from './BossSpawnLocation';

/** Original cached five-band heat, independent of enemy population/probability. */
export class MinibossSpawnHeat {
  readonly node: Mesh;
  private outerRadius = 0;
  private extentRatio = 1;
  private geometryValid = false;

  constructor(
    ui: NativeUI,
    private location: BossSpawnLocation | null,
  ) {
    const vertices = new (ui.cls('starling.rendering.VertexData'))();
    const indices = new (ui.cls('starling.rendering.IndexData'))();
    this.node = new (ui.cls('starling.display.Mesh'))(vertices, indices);
    this.node.set_touchable(false);
    this.node.set_visible(false);
    this.node.set_blendMode('normal');
    if (!location) return;
    const inner = location.innerRadius,
      outer = (this.outerRadius = location.outerRadius);
    if (
      !Number.isFinite(inner) ||
      !Number.isFinite(outer) ||
      inner < 0 ||
      outer <= 0 ||
      inner > outer
    )
      return;
    const innerRatio = inner / outer;
    let radii: number[], alphas: number[];
    if (inner === 0) {
      radii = [0, 0.35, 0.65, 0.85, 1];
      alphas = [0.16, 0.16, 0.12, 0.06, 0];
    } else {
      this.extentRatio = inner === outer ? 1.03 : 1;
      const span = this.extentRatio - innerRatio;
      radii = [
        innerRatio,
        innerRatio + span * 0.2,
        innerRatio + span * 0.5,
        innerRatio + span * 0.8,
        this.extentRatio,
      ];
      alphas = [0, 0.1, 0.16, 0.1, 0];
    }
    vertices.set_numVertices(160);
    this.node.set_color(0xe36b43);
    for (let band = 0; band < 5; band++)
      for (let segment = 0; segment < 32; segment++) {
        const angle = (segment * Math.PI * 2) / 32,
          vertex = band * 32 + segment;
        this.node.setVertexPosition(
          vertex,
          Math.cos(angle) * radii[band],
          Math.sin(angle) * radii[band],
        );
        this.node.setVertexAlpha(vertex, alphas[band]);
        if (band > 0) {
          const next = (segment + 1) % 32;
          indices.addQuad(
            (band - 1) * 32 + segment,
            vertex,
            (band - 1) * 32 + next,
            band * 32 + next,
          );
        }
      }
    this.geometryValid = true;
  }

  update(positionScale = 1, viewport?: SpawnViewport): void {
    const location = this.location;
    if (
      !this.geometryValid ||
      !location?.valid ||
      !Number.isFinite(positionScale) ||
      positionScale <= 0
    ) {
      this.node.set_visible(false);
      return;
    }
    const x = location.x * positionScale,
      y = location.y * positionScale;
    const scale = this.outerRadius * positionScale,
      radius = scale * this.extentRatio;
    if (![x, y, scale, radius].every(Number.isFinite)) {
      this.node.set_visible(false);
      return;
    }
    this.node.set_x(x);
    this.node.set_y(y);
    this.node.set_scaleX(scale);
    this.node.set_scaleY(scale);
    this.node.set_visible(spawnIntersects(viewport, x, y, radius));
  }

  dispose(): void {
    this.location = null;
    this.node.set_visible(false);
    this.node.removeFromParent(true);
  }
}
