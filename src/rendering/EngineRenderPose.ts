/** Original EngineRenderPose: share mount calculations across emitter coordinate reads. */
export class EngineRenderPose {
  x = 0;
  y = 0;
  rotation = 0;
  private previousX = NaN;
  private previousY = NaN;
  private previousRotation = NaN;
  private previousMountX = NaN;
  private previousMountY = NaN;

  update(shipX: number, shipY: number, shipRotation: number, mountX: number, mountY: number): void {
    if (
      shipX === this.previousX &&
      shipY === this.previousY &&
      shipRotation === this.previousRotation &&
      mountX === this.previousMountX &&
      mountY === this.previousMountY
    )
      return;
    this.previousX = shipX;
    this.previousY = shipY;
    this.previousRotation = shipRotation;
    this.previousMountX = mountX;
    this.previousMountY = mountY;
    // Preserve Engine.update's zero-X mount convention, rather than atan2.
    const radius = Math.hypot(mountX, mountY);
    const mountAngle = mountX !== 0 ? Math.atan(mountY / mountX) : 0;
    this.rotation = shipRotation + Math.PI;
    this.x = shipX + Math.cos(this.rotation + mountAngle) * radius;
    this.y = shipY + Math.sin(this.rotation + mountAngle) * radius;
  }
}
