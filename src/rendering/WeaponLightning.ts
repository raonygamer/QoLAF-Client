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
    while (this.lines.length < count) {
      const line = game.linePool.getLine();
      line.init(this.lineTexture, Math.trunc(this.thickness), this.get_color(), 1, true);
      line.set_blendMode('add');
      this.lines.push(line);
    }
    while (this.lines.length > count) game.linePool.removeLine(this.lines.pop());
    MeshBatch.prototype.clear.call(this);
    let seed = seeds.get(this);
    if (seed === undefined) {
      seed = Math.random() * 1000;
      seeds.set(this, seed);
    }
    const phase = performance.now() / 65;
    let lastX = 0;
    let lastY = 0;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / count;
      // Keep the native node spacing and amplitude envelope. Only the noise varies over time.
      const amplitude = this.amplitude * (2 - 2 * Math.abs(0.5 - i / count));
      const last = i === count - 1;
      const nextX = last ? dx : t * dx + amplitude * lightningNoise(seed + (i + 1) * 43.17, phase);
      const nextY = last
        ? dy
        : t * dy + amplitude * lightningNoise(seed + (i + 1) * 29.53 + 13, phase);
      const segment = this.lines[i];
      segment.set_x(lastX);
      segment.set_y(lastY);
      segment.lineTo(nextX, nextY);
      segment.set_thickness(this.thickness + width);
      this.addMesh(segment);
      lastX = nextX;
      lastY = nextY;
    }
  });
}
