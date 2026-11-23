import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MeshBatch, type GameScene } from '../game/Bindings';
import { lightningNoise } from './LightningNoise';

/** Share the native segment pool and keep each strand attached to its current endpoints. */
export function installWeaponLightning(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const Line = reflection.find('core.hud.components.BeamLine');
  if (!Line) return;
  const seeds = new WeakMap<object, number>();
  reflection.around(Line.prototype, 'lineTo', function (next, x, y, width = 1) {
    if (this.g !== game || !this.amplitude) return next(x, y, width);
    const dx = x - this.get_x();
    const dy = y - this.get_y();
    const count = Math.max(1, Math.round((Math.hypot(dx, dy) / this.period) * this.nodeFrequence));
    if (!Number.isFinite(count)) return next(x, y, width);
    const segments = count * 2 - 1;
    while (this.lines.length < segments) {
      const line = game.linePool.getLine();
      line.init(this.lineTexture, Math.trunc(this.thickness), this.get_color(), 1, true);
      line.set_blendMode('add');
      this.lines.push(line);
    }
    while (this.lines.length > segments) game.linePool.removeLine(this.lines.pop());
    MeshBatch.prototype.clear.call(this);
    let seed = seeds.get(this);
    if (seed === undefined) {
      seed = Math.random() * 1000;
      seeds.set(this, seed);
    }
    const phase = performance.now() / 65;
    let lastX = 0;
    let lastY = 0;
    let vertexX = 0;
    let vertexY = 0;
    let index = 0;
    const drawTo = (endX: number, endY: number) => {
      const segment = this.lines[index++];
      segment.set_x(vertexX);
      segment.set_y(vertexY);
      segment.lineTo(endX, endY);
      segment.set_thickness(this.thickness + width);
      this.addMesh(segment);
      vertexX = endX;
      vertexY = endY;
    };
    let previousNoiseX = 0;
    let previousNoiseY = 0;
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      const amplitude = i === count ? 0 : this.amplitude * Math.sin(t * Math.PI);
      const noiseX = lightningNoise(seed + i * 43.17, phase);
      const noiseY = lightningNoise(seed + i * 29.53 + 13, phase);
      const nextX = t * dx + amplitude * (0.8 * noiseX + 0.2 * previousNoiseX);
      const nextY = t * dy + amplitude * (0.8 * noiseY + 0.2 * previousNoiseY);
      // Clip twelve percent off each side of a kink, preserving the bolt silhouette.
      const spanX = nextX - lastX;
      const spanY = nextY - lastY;
      if (i > 1) drawTo(lastX + 0.12 * spanX, lastY + 0.12 * spanY);
      if (i === count) drawTo(dx, dy);
      else drawTo(nextX - 0.12 * spanX, nextY - 0.12 * spanY);
      lastX = nextX;
      lastY = nextY;
      previousNoiseX = noiseX;
      previousNoiseY = noiseY;
    }
  });
}
