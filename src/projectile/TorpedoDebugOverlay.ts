import { IndexData, Mesh, MeshBatch, Sprite, Text, VertexData } from '../game/Bindings';
import type { TorpedoDebugRow } from './TorpedoDebugTracker';

export interface TorpedoDebugPlayerPose {
  id: string | number;
  name: string;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  radius: number;
}

const purple = 0xbd79ff;
const white = 0xffffff;
const blue = 0x559fff;
const green = 0x7ae582;
const validPoint = (x: number, y: number) =>
  Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 10000000 && Math.abs(y) <= 10000000;
const validRadius = (radius: number) => Number.isFinite(radius) && radius > 0 && radius <= 10000;
const numberText = (value: number, decimals = 0) =>
  Number.isFinite(value) ? value.toFixed(decimals) : '?';

/** Source world-space snapshot viewer; projected positions are not server truth. */
export class TorpedoDebugOverlay {
  private readonly layer = new Sprite();
  private readonly batch = new MeshBatch();
  private readonly line = TorpedoDebugOverlay.createLine();
  private readonly ring = TorpedoDebugOverlay.createRing();
  private readonly torpedoLabels: Text[] = [];
  private readonly playerLabels: Text[] = [];
  private readonly torpedoLabelIds: (number | null)[] = [];
  private readonly playerLabelIds: (string | number | null)[] = [];
  private readonly statusLabel: Text;
  private lastLabels = 0;
  private labelsReady = false;
  private disposed = false;
  private labelScale = 1;

  constructor(
    private readonly canvas: Sprite,
    private readonly canvasProjectiles: Sprite,
  ) {
    this.layer.set_touchable(false);
    this.layer.set_visible(false);
    this.batch.set_touchable(false);
    this.layer.addChild(this.batch);
    for (let i = 0; i < 12; i++) {
      this.torpedoLabels.push(this.createLabel(white));
      this.torpedoLabelIds.push(null);
    }
    for (let i = 0; i < 6; i++) {
      this.playerLabels.push(this.createLabel(green));
      this.playerLabelIds.push(null);
    }
    this.statusLabel = this.createLabel(0xd5d5d5);
    canvasProjectiles.addChild(this.layer);
  }

  render(
    records: readonly TorpedoDebugRow[],
    players: readonly TorpedoDebugPlayerPose[],
    status: string,
    isLeaving: boolean,
    localMs = performance.now(),
  ): void {
    if (this.disposed) return;
    if (isLeaving || !this.canvas.get_visible() || !this.canvasProjectiles.get_visible()) {
      this.clear();
      return;
    }
    this.batch.clear();
    this.layer.set_visible(true);
    const zoom = Math.abs(this.canvas.get_scaleX());
    this.labelScale = Number.isFinite(zoom) && zoom > 0.01 ? 1 / zoom : 1;
    const now = localMs >>> 0;
    const updateLabels = !this.labelsReady || (now - this.lastLabels) >>> 0 >= 100;
    if (updateLabels) {
      this.lastLabels = now;
      this.labelsReady = true;
    }
    let anchorX = NaN;
    let anchorY = NaN;
    for (let i = 0; i < this.torpedoLabels.length; i++) {
      const label = this.torpedoLabels[i];
      label.set_visible(false);
      const entry = records[i];
      if (
        !entry ||
        !validPoint(entry.x, entry.y) ||
        !validPoint(entry.renderX, entry.renderY) ||
        !validRadius(entry.radius)
      )
        continue;
      this.drawTorpedo(entry);
      if (Number.isNaN(anchorX)) {
        anchorX = entry.renderX;
        anchorY = entry.renderY;
      }
      if (updateLabels) {
        label.set_text(this.torpedoText(entry));
        this.torpedoLabelIds[i] = entry.id;
      }
      this.positionLabel(
        label,
        entry.renderX + entry.radius + 5 * this.labelScale,
        entry.renderY - entry.radius,
      );
      // Do not attach an old caption to a different projectile between text updates.
      label.set_visible(this.torpedoLabelIds[i] === entry.id);
    }
    for (let i = 0; i < this.playerLabels.length; i++) {
      const label = this.playerLabels[i];
      label.set_visible(false);
      const entry = players[i];
      if (!entry || !validPoint(entry.x, entry.y) || !validRadius(entry.radius)) continue;
      this.drawRing(entry.x, entry.y, entry.radius, green, 0.7);
      const drawn = validPoint(entry.renderX, entry.renderY);
      const x = drawn ? entry.renderX : entry.x;
      const y = drawn ? entry.renderY : entry.y;
      if (Number.isNaN(anchorX)) {
        anchorX = x;
        anchorY = y;
      }
      if (updateLabels) {
        label.set_text(
          entry.name.slice(0, 24) + ' [player sim] r=' + numberText(entry.radius) + ' wu',
        );
        this.playerLabelIds[i] = entry.id;
      }
      this.positionLabel(label, x + entry.radius + 5 * this.labelScale, y);
      label.set_visible(this.playerLabelIds[i] === entry.id);
    }
    this.statusLabel.set_visible(!Number.isNaN(anchorX));
    if (!Number.isNaN(anchorX)) {
      if (updateLabels)
        this.statusLabel.set_text(
          'Purple: CLIENT projection from server snapshot; NOT actual server correction/live position\n' +
            'Blue: raw packet position; white: drawn; green: player sim; +: simulation; units: world / seconds\n' +
            status.slice(0, 180),
        );
      this.positionLabel(this.statusLabel, anchorX, anchorY - 80 * this.labelScale);
    }
  }

  private drawTorpedo(entry: TorpedoDebugRow): void {
    if (validPoint(entry.rawX, entry.rawY)) this.drawCross(entry.rawX, entry.rawY, 5, blue);
    if (validPoint(entry.projectedX, entry.projectedY)) {
      this.drawLine(
        entry.projectedX,
        entry.projectedY,
        entry.renderX,
        entry.renderY,
        purple,
        0.6,
        1,
      );
      this.drawRing(entry.projectedX, entry.projectedY, entry.radius, purple, 0.9);
    }
    this.drawRing(entry.renderX, entry.renderY, entry.radius, white, 0.9);
    this.drawCross(entry.x, entry.y, 3, white);
    if (!Number.isFinite(entry.vx) || !Number.isFinite(entry.vy)) return;
    const speed = Math.sqrt(entry.vx * entry.vx + entry.vy * entry.vy);
    if (!Number.isFinite(speed) || speed <= 0) return;
    const distance = Math.min(100, speed * 0.15);
    const dx = entry.vx / speed;
    const dy = entry.vy / speed;
    const endX = entry.x + dx * distance;
    const endY = entry.y + dy * distance;
    this.drawLine(entry.x, entry.y, endX, endY, white, 0.6, 1);
    const head = Math.min(distance * 0.4, 5 * this.labelScale);
    this.drawLine(
      endX,
      endY,
      endX - dx * head - dy * head * 0.5,
      endY - dy * head + dx * head * 0.5,
      white,
      0.6,
      1,
    );
    this.drawLine(
      endX,
      endY,
      endX - dx * head + dy * head * 0.5,
      endY - dy * head - dx * head * 0.5,
      white,
      0.6,
      1,
    );
  }

  private torpedoText(entry: TorpedoDebugRow): string {
    const speed =
      Number.isFinite(entry.vx) && Number.isFinite(entry.vy)
        ? Math.sqrt(entry.vx * entry.vx + entry.vy * entry.vy)
        : NaN;
    const gap =
      Number.isFinite(entry.correctionX) && Number.isFinite(entry.correctionY)
        ? Math.sqrt(entry.correctionX * entry.correctionX + entry.correctionY * entry.correctionY)
        : NaN;
    return (
      '#' +
      String(entry.id).slice(0, 18) +
      (entry.corrected ? ' corrected' : ' legacy') +
      ' | raw ' +
      (entry.rawSource ?? '?') +
      ' | recv corrections=' +
      numberText(entry.corrections) +
      '\n' +
      'raw age ' +
      numberText(entry.ageMs) +
      ' ms | gap=' +
      numberText(gap, 1) +
      ' wu\n' +
      'v=' +
      numberText(speed, 1) +
      ' (' +
      numberText(entry.vx, 1) +
      ',' +
      numberText(entry.vy, 1) +
      ') wu/s'
    );
  }

  private drawCross(x: number, y: number, radius: number, tint: number): void {
    radius *= this.labelScale;
    this.drawLine(x - radius, y, x + radius, y, tint, 0.85, 1);
    this.drawLine(x, y - radius, x, y + radius, tint, 0.85, 1);
  }

  private drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    tint: number,
    opacity: number,
    width: number,
  ): void {
    if (!validPoint(x1, y1) || !validPoint(x2, y2)) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (!Number.isFinite(length) || length <= 0) return;
    this.line.set_x(x1);
    this.line.set_y(y1);
    this.line.set_scaleX(length);
    this.line.set_scaleY(width * this.labelScale);
    this.line.set_rotation(Math.atan2(dy, dx));
    this.line.set_color(tint);
    this.line.set_alpha(opacity);
    if (this.batch.canAddMesh(this.line)) this.batch.addMesh(this.line);
  }

  private drawRing(x: number, y: number, radius: number, tint: number, opacity: number): void {
    this.ring.set_x(x);
    this.ring.set_y(y);
    this.ring.set_scaleX(radius);
    this.ring.set_scaleY(radius);
    this.ring.set_color(tint);
    this.ring.set_alpha(opacity);
    if (this.batch.canAddMesh(this.ring)) this.batch.addMesh(this.ring);
  }

  private positionLabel(label: Text, x: number, y: number): void {
    label.set_x(x);
    label.set_y(y);
    label.set_scaleX(this.labelScale);
    label.set_scaleY(this.labelScale);
  }

  private createLabel(tint: number): Text {
    const label = new Text();
    label.set_size(9);
    label.set_color(tint);
    label.set_touchable(false);
    label.set_visible(false);
    this.layer.addChild(label);
    return label;
  }

  private static createLine(): Mesh {
    const vertices = new VertexData();
    const indices = new IndexData();
    vertices.set_numVertices(4);
    const mesh = new Mesh(vertices, indices);
    mesh.setVertexPosition(0, 0, -0.5);
    mesh.setVertexPosition(1, 1, -0.5);
    mesh.setVertexPosition(2, 0, 0.5);
    mesh.setVertexPosition(3, 1, 0.5);
    indices.addQuad(0, 1, 2, 3);
    mesh.set_touchable(false);
    return mesh;
  }

  private static createRing(): Mesh {
    const vertices = new VertexData();
    const indices = new IndexData();
    vertices.set_numVertices(66);
    const mesh = new Mesh(vertices, indices);
    for (let i = 0; i <= 32; i++) {
      const angle = (i * Math.PI * 2) / 32;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      mesh.setVertexPosition(i * 2, dx, dy);
      mesh.setVertexPosition(i * 2 + 1, dx * 0.94, dy * 0.94);
      if (i > 0) indices.addQuad(i * 2 - 2, i * 2 - 1, i * 2, i * 2 + 1);
    }
    mesh.set_touchable(false);
    return mesh;
  }

  clear(): void {
    if (this.disposed) return;
    this.batch.clear();
    this.layer.set_visible(false);
    this.labelsReady = false;
    for (const label of this.torpedoLabels) label.set_visible(false);
    for (const label of this.playerLabels) label.set_visible(false);
    this.statusLabel.set_visible(false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.layer.removeFromParent(true);
    this.line.dispose();
    this.ring.dispose();
    this.torpedoLabels.length = this.playerLabels.length = 0;
    this.torpedoLabelIds.length = this.playerLabelIds.length = 0;
  }
}
