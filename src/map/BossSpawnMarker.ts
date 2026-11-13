import type { Sprite } from '../game/Bindings';
import { read, type Raw } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { BossSpawnAreaRing } from './BossSpawnAreaRing';
import { BossSpawnLocation, spawnIntersects, type SpawnViewport } from './BossSpawnLocation';

/** Original hollow diamond and labels, distinct from the live boss icon. */
export class BossSpawnMarker {
  readonly node: Sprite;
  private readonly badge: Sprite;
  private readonly badgeRadius: number;
  private outerRing?: BossSpawnAreaRing;
  private innerRing?: BossSpawnAreaRing;
  private gravityRing?: BossSpawnAreaRing;

  constructor(
    ui: NativeUI,
    private location: BossSpawnLocation | null,
    compact = false,
  ) {
    const source = location!;
    this.node = ui.sprite();
    this.node.set_touchable(false);
    this.badge = ui.sprite();
    const tint = source.boss ? 0xff8a72 : 0xf5c66b;
    if (source.gravityRadius > 0) {
      this.gravityRing = new BossSpawnAreaRing(ui, tint);
      this.node.addChild(this.gravityRing.node);
    }
    if (source.outerRadius > 0) {
      this.outerRing = new BossSpawnAreaRing(ui, tint);
      this.node.addChild(this.outerRing.node);
    }
    if (source.innerRadius > 0 && source.innerRadius < source.outerRadius) {
      this.innerRing = new BossSpawnAreaRing(ui, tint);
      this.node.addChild(this.innerRing.node);
    }
    this.node.addChild(this.badge);
    const size = compact ? 5 : 7;
    for (let i = 0; i < 4; i++) {
      const edge = ui.quad(size * Math.SQRT2, 1.5, tint),
        angle = (i * Math.PI) / 2;
      edge.set_x(Math.cos(angle) * size);
      edge.set_y(Math.sin(angle) * size);
      edge.set_rotation(angle + (Math.PI * 3) / 4);
      this.badge.addChild(edge);
    }
    const TextBitmap = ui.cls('core.hud.components.TextBitmap');
    const name = new TextBitmap(0, 0, source.name, compact ? 10 : 13);
    name.get_format().set_color(tint);
    name.set_batchable(true);
    name.set_x(-read(name, 'width') / 2);
    name.set_y(size + 3);
    this.badge.addChild(name);
    const detail = new TextBitmap(0, 0, source.detail, compact ? 8 : 10);
    detail.get_format().set_color(tint);
    detail.set_alpha(0.8);
    detail.set_batchable(true);
    detail.set_x(-read(detail, 'width') / 2);
    detail.set_y(read(name, 'y') + read(name, 'height'));
    this.badge.addChild(detail);
    this.badgeRadius =
      Math.max(
        read(name, 'width') / 2,
        read(detail, 'width') / 2,
        read(detail, 'y') + read(detail, 'height'),
      ) + 8;
  }

  update(positionScale: number, badgeScale = 1, viewport?: SpawnViewport): void {
    const location = this.location;
    if (
      !location?.valid ||
      location.bossAlive ||
      !Number.isFinite(positionScale) ||
      positionScale <= 0 ||
      !Number.isFinite(badgeScale) ||
      badgeScale <= 0
    ) {
      this.node.set_visible(false);
      return;
    }
    const x = location.x * positionScale,
      y = location.y * positionScale;
    this.node.set_x(x);
    this.node.set_y(y);
    let visible = spawnIntersects(
      viewport,
      x,
      y,
      Math.max(location.outerRadius * positionScale, this.badgeRadius * badgeScale),
    );
    if (this.gravityRing) {
      const radius = location.gravityRadius * positionScale;
      this.gravityRing.node.set_visible(radius > 0);
      if (radius > 0) {
        const gx = location.gravityX * positionScale,
          gy = location.gravityY * positionScale;
        this.gravityRing.node.set_x(gx - x);
        this.gravityRing.node.set_y(gy - y);
        this.gravityRing.setGeometry(radius, 1.25 * badgeScale);
        visible ||= spawnIntersects(viewport, gx, gy, radius);
      }
    }
    this.node.set_visible(visible);
    if (!visible) return;
    this.badge.set_visible(spawnIntersects(viewport, x, y, this.badgeRadius * badgeScale));
    this.badge.set_scaleX(badgeScale);
    this.badge.set_scaleY(badgeScale);
    this.outerRing?.setGeometry(location.outerRadius * positionScale, 1.25 * badgeScale);
    this.innerRing?.setGeometry(location.innerRadius * positionScale, 1.25 * badgeScale);
  }

  dispose(): void {
    this.location = null;
    this.node.removeFromParent(true);
  }
}
