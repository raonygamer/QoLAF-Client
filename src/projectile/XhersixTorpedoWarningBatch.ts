import { read, type API, type Raw } from '../api/Types';
import { xhersixTorpedoWeaponKey } from './XhersixTorpedoCue';

/** Original shared collision disk and border; radius comes from the live projectile. */
export class XhersixTorpedoWarningBatch {
  readonly node: Raw;
  private readonly ring: Raw;

  constructor(api: API) {
    const MeshBatch = api.cls('starling.display.MeshBatch') as any;
    const Mesh = api.cls('starling.display.Mesh') as any;
    const VertexData = api.cls('starling.rendering.VertexData') as any;
    const IndexData = api.cls('starling.rendering.IndexData') as any;
    this.node = new MeshBatch();
    this.node.set_touchable(false);
    const vertices = new VertexData(),
      indices = new IndexData();
    vertices.set_numVertices(196);
    this.ring = new Mesh(vertices, indices);
    this.ring.set_color(0xff3030);
    this.ring.setVertexPosition(0, 0, 0);
    this.ring.setVertexAlpha(0, 0.12);
    for (let i = 0; i <= 64; i++) {
      const angle = (i * Math.PI * 2) / 64;
      const x = Math.cos(angle),
        y = Math.sin(angle),
        first = 1 + i * 3;
      this.ring.setVertexPosition(first, x * 0.92, y * 0.92);
      this.ring.setVertexAlpha(first, 0.12);
      this.ring.setVertexPosition(first + 1, x, y);
      this.ring.setVertexAlpha(first + 1, 0.8);
      this.ring.setVertexPosition(first + 2, x * 0.92, y * 0.92);
      this.ring.setVertexAlpha(first + 2, 0.8);
      if (i > 0) {
        indices.addTriangle(0, first - 3, first);
        indices.addQuad(first - 2, first - 1, first + 1, first + 2);
      }
    }
    this.ring.set_touchable(false);
  }

  addProjectile(projectile: Raw): void {
    const clip = read(projectile, 'movieClip');
    if (
      !projectile.alive ||
      !projectile.isEnemy ||
      !projectile.isVisible ||
      projectile.weapon?.key !== xhersixTorpedoWeaponKey ||
      !Number.isFinite(projectile.collisionRadius) ||
      projectile.collisionRadius <= 0 ||
      !clip
    )
      return;
    this.ring.set_x(read(clip, 'x'));
    this.ring.set_y(read(clip, 'y'));
    this.ring.set_scaleX(projectile.collisionRadius);
    this.ring.set_scaleY(projectile.collisionRadius);
    if (this.node.canAddMesh(this.ring)) this.node.addMesh(this.ring);
  }

  clear(): void {
    this.node.clear();
  }
  dispose(): void {
    this.ring.dispose();
    this.node.removeFromParent(true);
  }
}

/** Attach after native draw has assigned the frame's visible projectile position. */
export function installTorpedoWarnings(
  api: API,
  game: Raw,
  createBatch: () => XhersixTorpedoWarningBatch = () => new XhersixTorpedoWarningBatch(api),
): void {
  const projectile = api.cls('core.projectile.Projectile')?.prototype;
  if (typeof game.draw !== 'function' || typeof projectile?.draw !== 'function') return;
  let batch: XhersixTorpedoWarningBatch | undefined;
  let drawing = false;
  api.around(game, 'draw', function (next, ...args) {
    batch?.clear();
    const previous = drawing;
    drawing = !!api.cls('core.scene.SceneBase')?.clientSettings?.showXhersixTorpedoWarnings;
    try {
      return next(...args);
    } finally {
      drawing = previous;
    }
  });
  api.after(projectile, 'draw', function () {
    if (
      !drawing ||
      this.g !== game ||
      !read(this, 'isAddedToCanvas') ||
      this.weapon?.key !== xhersixTorpedoWeaponKey
    )
      return;
    if (!batch) {
      batch = createBatch();
      game.canvasProjectiles.addChild(batch.node);
    }
    batch.addProjectile(this);
  });
  api.defer(() => batch?.dispose());
}
