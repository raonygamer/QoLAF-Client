/** Source keyboard/wheel zoom gesture, with one persistence flush when it ends. */
export class WorldZoom {
  private dirty = false;
  private wheelTimer?: ReturnType<typeof setTimeout>;
  private keysHeld = false;

  constructor(
    private readZoom: () => number,
    private applyZoom: (zoom: number) => void,
    private saveZoom: (zoom: number) => void,
    private flush: () => void,
    private readKeysHeld: () => boolean = () => this.keysHeld,
  ) {}

  static clamp(value: number): number {
    return Number.isFinite(value) ? Math.max(0.25, Math.min(2, value)) : 1;
  }

  keyboard(zoomIn: boolean, zoomOut: boolean): void {
    this.keysHeld = zoomIn || zoomOut;
    if (!this.keysHeld) {
      this.commit();
      return;
    }
    const zoom = this.readZoom();
    this.change(zoomIn && zoomOut ? 1 : zoomOut ? zoom * 0.98 : zoom / 0.98);
  }

  wheel(deltaY: number): void {
    if (!deltaY) return;
    const zoom = WorldZoom.clamp(this.readZoom() * (deltaY < 0 ? 1.08 : 1 / 1.08));
    if (zoom === this.readZoom()) return;
    this.change(zoom);
    if (this.wheelTimer !== undefined) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => {
      this.wheelTimer = undefined;
      if (!this.readKeysHeld()) this.commit();
    }, 250);
  }

  private change(value: number): void {
    const zoom = WorldZoom.clamp(value);
    this.dirty = true;
    if (zoom !== this.readZoom()) this.saveZoom(zoom);
    this.applyZoom(zoom);
  }

  private commit(): void {
    if (!this.dirty || this.wheelTimer !== undefined) return;
    this.dirty = false;
    this.flush();
  }

  dispose(): void {
    if (this.wheelTimer !== undefined) clearTimeout(this.wheelTimer);
    this.wheelTimer = undefined;
    this.keysHeld = false;
    this.commit();
  }
}
