import type { API } from '../api/Types';
import { Point, type GameScene } from '../game/Bindings';
import { RingDistortionSource, RingDistortionTextures } from './RingDistortionSource';

/** Original Nexar/Shadow bomb shell timing and world-to-screen projection. */
export class ShockwaveDistortion {
  readonly source: RingDistortionSource;
  private readonly worldPosition: Point;
  private readonly screenPosition: Point;
  private readonly blastRadius: number;
  private readonly startTime: number;
  private readonly duration: number;
  private disposed = false;

  constructor(
    api: API,
    textures: RingDistortionTextures,
    private readonly game: GameScene,
    x: number,
    y: number,
    blastRadius: number,
    blastSpeed: number,
  ) {
    this.worldPosition = new Point(x, y);
    this.screenPosition = new Point();
    this.blastRadius = Math.max(1, blastRadius);
    const speed = Number.isFinite(blastSpeed) && blastSpeed > 0 ? blastSpeed : 350;
    this.startTime = game.time + 80;
    this.duration = (this.blastRadius / speed) * 1000;
    this.source = new RingDistortionSource(api, textures, 128, 128, 0.45, 0.065, 18);
  }

  get expired(): boolean {
    return this.game.time >= this.startTime + this.duration;
  }

  updatePosition(): boolean {
    if (this.disposed) return false;
    const progress = (this.game.time - this.startTime) / this.duration;
    if (progress <= 0 || progress >= 1) return false;
    const canvas = this.game.canvas;
    const camera = this.game.camera;
    if (!canvas || !camera) return false;
    const scaleX = canvas.get_scaleX();
    const scaleY = canvas.get_scaleY();
    const minimumScale = Math.max(0.001, Math.min(Math.abs(scaleX), Math.abs(scaleY)));
    const boundsRadius =
      (this.blastRadius * (0.45 + 0.065)) / 0.45 + (this.source.strength * 0.5) / minimumScale;
    if (!camera.isCircleOnScreen(this.worldPosition.x, this.worldPosition.y, boundsRadius))
      return false;
    canvas.localToGlobal(this.worldPosition, this.screenPosition);
    this.source.centerAt(
      this.screenPosition.x,
      this.screenPosition.y,
      scaleX,
      scaleY,
      (this.blastRadius * progress) / this.source.ringRadius,
      Math.sin(Math.PI * progress),
    );
    return this.source.effectiveStrength > 0.001;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.source.dispose();
  }
}
