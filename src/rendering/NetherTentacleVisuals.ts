import type { Projectile } from '../game/Bindings';
import { weaponLaunchOffset } from './WeaponLaunchPose';
import { read, type API, type Raw } from '../api/Types';

interface Snapshot {
  x: number;
  y: number;
  endX: number;
  endY: number;
  rangeScale: number;
  queuedAt: number;
  startedAt: number;
  inner: Raw | null;
  outer: Raw | null;
}

export function isNetherTentacle(api: API, projectile: Raw): boolean {
  const Enemy = api.cls('core.ship.EnemyShip') as any;
  return (
    projectile?.weapon?.key === '0O4EOmZ-_USlz3RhlUCQ4Q' &&
    !!Enemy &&
    projectile.unit instanceof Enemy &&
    projectile.unit.hasFaction('Nether')
  );
}

/** Source room-owned snapshots survive projectile expiry without extending attack TTL. */
export class NetherTentacleVisuals {
  private layer: Raw;
  private active: Snapshot[] = [];
  private available: Snapshot[] = [];
  private ready = false;
  private color = 0;
  private glow = 0;
  private thickness = 0;
  private opacity = 0;
  private amplitude = 0;
  private frequency = 0;
  private texture = 'line2';

  constructor(
    private api: API,
    private game: Raw | null,
    private now: () => number = () => performance.now() >>> 0,
  ) {
    const Sprite = api.cls('starling.display.Sprite') as any;
    this.layer = new Sprite();
    this.layer.set_touchable(false);
    this.layer.set_visible(false);
    if (!game?.canvasEffects || !game.dataManager) return;
    game.canvasEffects.addChild(this.layer);
    const style = game.dataManager.loadKey('Projectiles', 'KWoBRRlucUW4kboRHw8Oyw');
    if (!style || style.ai !== 'instant') return;
    this.color = Number(style.color);
    this.glow = Number(style.glowColor);
    this.thickness = 4 * Number(style.thickness);
    this.opacity = Number(style.alpha);
    this.amplitude = Object.hasOwn(style, 'amplitude') ? Number(style.amplitude) : 0;
    this.frequency = Object.hasOwn(style, 'frequency') ? 0.1 * Number(style.frequency) : 0.1;
    if (
      ![this.color, this.glow, this.thickness, this.opacity, this.amplitude, this.frequency].every(
        Number.isFinite,
      ) ||
      this.color < 0 ||
      this.color > 0xffffff ||
      this.glow < 0 ||
      this.glow > 0xffffff ||
      this.thickness <= 0 ||
      this.opacity <= 0 ||
      this.amplitude < 0 ||
      this.frequency < 0
    )
      return;
    this.color >>>= 0;
    this.glow >>>= 0;
    if (style.texture != null && String(style.texture).length) this.texture = String(style.texture);
    this.ready = true;
  }

  addProjectile(projectile: Raw): void {
    const game = this.game;
    const position = read(projectile, 'pos');
    if (
      !game ||
      !this.ready ||
      !game.beamLinePool ||
      !read(game.canvas, 'visible') ||
      this.active.length >= 128 ||
      !isNetherTentacle(this.api, projectile) ||
      !position
    )
      return;
    const launch = weaponLaunchOffset(projectile as Projectile);
    const x = position.x + (launch?.x ?? 0),
      y = position.y + (launch?.y ?? 0),
      angle = read(projectile, 'rotation') + (launch?.rotation ?? 0);
    const range = projectile.range,
      weaponRange = projectile.weapon.range,
      queuedAt = this.now();
    if (
      ![x, y, angle, range, weaponRange, queuedAt].every(Number.isFinite) ||
      range <= 0 ||
      weaponRange <= 0 ||
      Math.round((range / 100) * Math.trunc(this.frequency)) > 128
    )
      return;
    const endX = x + Math.cos(angle) * range,
      endY = y + Math.sin(angle) * range;
    const rangeScale = 0.1 + (0.9 * range) / weaponRange;
    if (![endX, endY, rangeScale, this.thickness * rangeScale].every(Number.isFinite)) return;
    const shot: Snapshot = Object.assign(this.available.pop() ?? {}, {
      x,
      y,
      endX,
      endY,
      rangeScale,
      queuedAt,
      startedAt: NaN,
      inner: null,
      outer: null,
    });
    try {
      shot.inner = game.beamLinePool.getLine();
      this.prepareLine(shot.inner!, shot, 0xffffff, 0xffffff);
      shot.outer = game.beamLinePool.getLine();
      this.prepareLine(shot.outer!, shot, this.color, this.glow);
      this.active.push(shot);
    } catch {
      this.release(shot);
    }
  }

  private prepareLine(line: Raw, shot: Snapshot, color: number, glow: number): void {
    line.init(1, this.frequency, this.amplitude, color, 0, 3, glow, this.texture);
    line.set_touchable(false);
    line.set_x(shot.x);
    line.set_y(shot.y);
    line.lineTo(shot.endX, shot.endY);
    line.set_visible(false);
    this.layer.addChild(line);
  }

  draw(): void {
    if (!this.game) return;
    const now = this.now();
    const canDraw =
      Number.isFinite(now) && !!read(this.game, 'stage') && read(this.game.canvas, 'visible');
    this.layer.set_visible(canDraw && this.active.length > 0);
    for (let index = this.active.length - 1; index >= 0; index--) {
      const shot = this.active[index];
      if (Number.isNaN(shot.startedAt)) {
        if (!canDraw || (now - shot.queuedAt) >>> 0 > 500) {
          this.remove(index);
          continue;
        }
        shot.startedAt = now;
      }
      const remaining = 350 - ((now - shot.startedAt) >>> 0);
      if (!Number.isFinite(remaining) || remaining <= 0) {
        this.remove(index);
        continue;
      }
      if (!canDraw) continue;
      if (remaining > 0.25 * 350) {
        const fade = (remaining - 0.25 * 350) / (0.75 * 350);
        shot.inner!.thickness = 0.3 * this.thickness * shot.rangeScale * (0.2 + 0.8 * fade);
        shot.inner!.set_alpha(fade);
        shot.inner!.lineTo(shot.endX, shot.endY);
        shot.inner!.set_visible(true);
      } else shot.inner!.set_visible(false);
      shot.outer!.thickness = this.thickness * shot.rangeScale * (0.2 + (0.8 * remaining) / 350);
      shot.outer!.set_alpha((this.opacity * remaining) / 350);
      shot.outer!.lineTo(shot.endX, shot.endY);
      shot.outer!.set_visible(true);
    }
    if (!this.active.length) this.layer.set_visible(false);
  }

  private remove(index: number): void {
    const shot = this.active[index];
    const last = this.active.pop()!;
    if (index < this.active.length) this.active[index] = last;
    this.release(shot);
  }

  private release(shot: Snapshot): void {
    for (const line of [shot.inner, shot.outer]) {
      if (!line) continue;
      // Haxe's pool does not detach returned lines; release the display parent too.
      line.set_visible(false);
      line.clear();
      line.removeFromParent();
      this.game!.beamLinePool.removeLine(line);
    }
    shot.inner = shot.outer = null;
    shot.startedAt = NaN;
    this.available.push(shot);
  }

  dispose(): void {
    if (!this.game) return;
    while (this.active.length) this.remove(this.active.length - 1);
    this.available.length = 0;
    this.layer.removeFromParent(true);
    this.game = null;
  }
}

export function installNetherTentacleVisuals(api: API): void {
  const Manager = api.cls('core.projectile.ProjectileManager')?.prototype;
  const Game = api.cls('core.scene.Game')?.prototype;
  if (!Manager || !Game || !api.cls('starling.display.Sprite')) return;
  const rooms = new Map<Raw, NetherTentacleVisuals>();
  const release = (game: Raw) => {
    rooms.get(game)?.dispose();
    rooms.delete(game);
  };
  api.after(Manager, 'activateProjectile', function (_result, projectile) {
    if (!isNetherTentacle(api, projectile)) return;
    let visuals = rooms.get(this.g);
    if (!visuals) rooms.set(this.g, (visuals = new NetherTentacleVisuals(api, this.g)));
    visuals.addProjectile(projectile);
  });
  api.after(Game, 'draw', function () {
    rooms.get(this)?.draw();
  });
  api.before(Manager, 'dispose', function () {
    release(this.g);
  });
  api.before(Game, 'exit', function () {
    release(this);
  });
  api.defer(() => {
    for (const game of rooms.keys()) release(game);
  });
}
