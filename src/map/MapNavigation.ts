/** Original Map.as pan/zoom arithmetic, in the map viewport's local coordinates. */
export class MapNavigation {
  zoom = 1;
  centerX = 0;
  centerY = 0;
  followingPlayer = true;
  dragTouchId = -1;
  cancelledTouchId = -1;
  panGestureActive = false;
  private startX = 0;
  private startY = 0;
  private dragCenterX = 0;
  private dragCenterY = 0;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
  get x(): number {
    return this.width / 2 - this.centerX * this.zoom;
  }
  get y(): number {
    return this.height / 2 - this.centerY * this.zoom;
  }

  follow(x: number, y: number): void {
    if (this.followingPlayer && this.dragTouchId < 0) {
      this.centerX = x;
      this.centerY = y;
    }
  }
  center(x: number, y: number): void {
    this.followingPlayer = true;
    this.cancelPan();
    this.follow(x, y);
  }
  begin(id: number, x: number, y: number): void {
    if (this.dragTouchId >= 0) return;
    this.cancelledTouchId = -1;
    this.dragTouchId = id;
    this.startX = x;
    this.startY = y;
    this.dragCenterX = this.centerX;
    this.dragCenterY = this.centerY;
    this.panGestureActive = false;
  }
  detectPan(x: number, y: number): boolean {
    const dx = x - this.startX,
      dy = y - this.startY;
    if (this.dragTouchId >= 0 && dx * dx + dy * dy >= 16) this.panGestureActive = true;
    return this.panGestureActive;
  }
  move(id: number, x: number, y: number): void {
    if (id !== this.dragTouchId || id < 0) return;
    if (this.detectPan(x, y)) {
      this.followingPlayer = false;
      this.centerX = this.dragCenterX - (x - this.startX) / this.zoom;
      this.centerY = this.dragCenterY - (y - this.startY) / this.zoom;
    }
  }
  cancelPan(): void {
    if (this.dragTouchId >= 0) this.cancelledTouchId = this.dragTouchId;
    this.dragTouchId = -1;
    this.panGestureActive = false;
  }
  wheel(delta: number, x: number, y: number): void {
    if (!delta || this.dragTouchId >= 0) return;
    const zoom = Math.max(0.25, Math.min(4, this.zoom * (delta > 0 ? 1.15 : 1 / 1.15)));
    if (zoom === this.zoom) return;
    const anchorX = (x - this.x) / this.zoom,
      anchorY = (y - this.y) / this.zoom;
    this.zoom = zoom;
    this.followingPlayer = false;
    this.centerX = anchorX - (x - this.width / 2) / zoom;
    this.centerY = anchorY - (y - this.height / 2) / zoom;
  }
}
