import { read, type Raw } from '../Api/Types';
import type { BossSpawnDescription } from './BossSpawnCatalog';

/** Configured anchors survive enemy deaths; pooled anchor resets invalidate them. */
export class BossSpawnLocation {
  readonly name: string;
  readonly detail: string;
  readonly boss: boolean;
  readonly innerRadius: number;
  readonly outerRadius: number;
  private readonly anchorLife: number;
  private gravityBody?: Raw;
  private gravityLife = 0;

  constructor(
    private anchor: Raw | null,
    description: BossSpawnDescription,
    private game: Raw | null,
    private readonly life: (object: Raw) => number,
  ) {
    this.anchorLife = life(anchor!);
    this.name = description.name;
    this.detail = description.detail;
    this.boss = description.boss;
    this.innerRadius = description.innerRadius;
    this.outerRadius = description.outerRadius;
  }

  get valid(): boolean {
    return (
      !!this.anchor &&
      this.life(this.anchor) === this.anchorLife &&
      Number.isFinite(read(this.anchor, 'x')) &&
      Number.isFinite(read(this.anchor, 'y'))
    );
  }

  setGravityBody(body: Raw | null): void {
    this.gravityBody = undefined;
    if (body?.type !== 'sun' || body.obj?.bitmap !== 'inkBvexWnU6i7SjD6pd7wA') return;
    this.gravityBody = body;
    this.gravityLife = this.life(body);
  }

  get gravityRadius(): number {
    const body = this.gravityBody;
    if (
      !body ||
      this.life(body) !== this.gravityLife ||
      !Number.isFinite(this.renderCoordinate(body, 'x')) ||
      !Number.isFinite(this.renderCoordinate(body, 'y')) ||
      !Number.isFinite(body.gravityDistance) ||
      body.gravityDistance <= 0 ||
      !Number.isFinite(body.gravityForce) ||
      body.gravityForce === 0
    )
      return 0;
    return Math.sqrt(body.gravityDistance);
  }

  get gravityX(): number {
    return this.renderCoordinate(this.gravityBody, 'x');
  }
  get gravityY(): number {
    return this.renderCoordinate(this.gravityBody, 'y');
  }
  get x(): number {
    return this.renderCoordinate(this.anchor, 'x');
  }
  get y(): number {
    return this.renderCoordinate(this.anchor, 'y');
  }

  private renderCoordinate(object: Raw | null | undefined, axis: 'x' | 'y'): number {
    // Hidden native anchors have no drawn clip; native bodies use their current orbit pose.
    return read(object, axis === 'x' ? 'renderX' : 'renderY', read(object, axis, 0));
  }

  get bossAlive(): boolean {
    return (
      this.boss &&
      this.valid &&
      (this.game?.bossManager?.bosses ?? []).some(
        (boss: Raw) =>
          boss && boss.alive && !boss.awaitingActivation && boss.parentBody === this.anchor,
      )
    );
  }

  dispose(): void {
    this.anchor = this.game = null;
    this.gravityBody = undefined;
  }
}

export interface SpawnViewport {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export function spawnIntersects(
  viewport: SpawnViewport | undefined,
  x: number,
  y: number,
  radius: number,
): boolean {
  return (
    !viewport ||
    (x + radius >= viewport.left &&
      x - radius <= viewport.right &&
      y + radius >= viewport.top &&
      y - radius <= viewport.bottom)
  );
}
