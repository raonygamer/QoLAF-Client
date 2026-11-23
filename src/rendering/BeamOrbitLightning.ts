import { Mesh, VertexData, IndexData, type Weapon } from '../game/Bindings';

const SEGMENTS = 12;
const MAX_ORBITS = 3;
const SUPPORTED_WEAPONS = new Set([
  'mG64bGPqEUaJHvf2sadUHg',
  'AoaS8cYoZk6Sg11nJdYqIw',
  'iFJpW8UJnEev0Kt3AQ9kcQ',
  'u0LhYHLM1UKe2v2_f0Jh0Q',
  '222ekuHQxE6j9IOXMVXs6g',
]);

export function supportsBeamOrbit(projectile: { weapon?: Pick<Weapon, 'key'> | null }): boolean {
  return SUPPORTED_WEAPONS.has(projectile.weapon?.key ?? '');
}

/** Original BeamOrbitLightning geometry, using the game's native Starling mesh. */
export function createBeamOrbitLightning() {
  return class BeamOrbitLightning extends Mesh {
    private released = false;
    constructor() {
      super(new VertexData(), new IndexData());
      this.set_touchable(false);
      this.set_visible(false);
      this.set_blendMode('add');
      this.get_vertexData().set_numVertices(MAX_ORBITS * SEGMENTS * 8);
      for (let i = 0; i < MAX_ORBITS * SEGMENTS * 8; i += 4)
        this.get_indexData().addQuad(i, i + 1, i + 2, i + 3);
    }
    drawBetween(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      thickness: number,
      color: number,
      time: number,
      opacity: number,
    ): void {
      if (this.released) return;
      this.set_visible(false);
      if (
        !isFinite(x0) ||
        !isFinite(y0) ||
        !isFinite(x1) ||
        !isFinite(y1) ||
        !isFinite(thickness) ||
        !isFinite(time) ||
        !isFinite(opacity) ||
        opacity <= 0
      )
        return;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 24 || length > 10000) return;
      this.set_x(x0);
      this.set_y(y0);
      this.set_rotation(Math.atan2(dy, dx));
      this.set_alpha(Math.min(1, opacity));
      const count = Math.min(MAX_ORBITS, Math.max(1, Math.trunc(length / 140)));
      const radius = Math.max(5, Math.min(22, thickness * 0.6 + 3));
      const phase = ((time % 1200) / 1200) * Math.PI * 2;
      const flicker = Math.trunc(time / 55);
      // Fixed-capacity geometry: unused orbits collapse instead of allocating.
      for (let orbit = 0; orbit < MAX_ORBITS; orbit++) {
        const center = (length * (orbit + 1)) / (count + 1);
        let previousX = 0;
        let previousY = 0;
        for (let i = 0; i <= SEGMENTS; i++) {
          const t = i / SEGMENTS;
          const angle = phase + orbit * 2.1 + t * Math.PI * 1.6;
          let noise = Math.sin(i * 43.17 + orbit * 17 + flicker * 12.31) * 43758.5453;
          noise = (noise - Math.floor(noise)) * 2 - 1;
          const r = radius + noise * 1.5 * Math.sin(t * Math.PI);
          const nextX = orbit < count ? center + Math.cos(angle) * r * 0.38 : 0;
          const nextY = orbit < count ? Math.sin(angle) * r : 0;
          if (i > 0) {
            const base = (orbit * SEGMENTS + i - 1) * 8;
            const fade = Math.sin(((i - 0.5) / SEGMENTS) * Math.PI);
            this.segment(base, previousX, previousY, nextX, nextY, 2.5, color, 0.16 * fade);
            this.segment(base + 4, previousX, previousY, nextX, nextY, 0.7, color, 0.85 * fade);
          }
          previousX = nextX;
          previousY = nextY;
        }
      }
      this.setVertexDataChanged();
      this.set_visible(true);
    }

    private segment(
      index: number,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      width: number,
      color: number,
      opacity: number,
    ): void {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      const nx = (-dy / length) * width * 0.5;
      const ny = (dx / length) * width * 0.5;
      this.get_vertexData().setPoint(index, 'position', x0 - nx, y0 - ny);
      this.get_vertexData().setPoint(index + 1, 'position', x0 + nx, y0 + ny);
      this.get_vertexData().setPoint(index + 2, 'position', x1 - nx, y1 - ny);
      this.get_vertexData().setPoint(index + 3, 'position', x1 + nx, y1 + ny);
      this.get_vertexData().colorize('color', color, opacity, index, 4);
    }

    dispose(): void {
      if (this.released) return;
      this.released = true;
      this.set_visible(false);
      super.dispose();
    }
  };
}
