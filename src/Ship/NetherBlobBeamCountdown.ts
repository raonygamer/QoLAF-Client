import { read, type API, type Raw } from '../Api/Types';

/** Original observed-shot estimate; never predicts or changes an enemy attack. */
export class NetherBlobBeamCountdown {
  static readonly weaponKey = '222ekuHQxE6j9IOXMVXs6g';
  private lastShotTime = NaN;
  private readyTime = NaN;
  private displayedTenths = -1;
  private label?: Raw;

  constructor(private readonly api: API) {}

  observeShot(weapon: Raw, shotTime: number): void {
    if (
      weapon?.key !== NetherBlobBeamCountdown.weaponKey ||
      !Number.isFinite(shotTime) ||
      shotTime <= 0 ||
      (!Number.isNaN(this.lastShotTime) && shotTime <= this.lastShotTime)
    )
      return;
    this.lastShotTime = shotTime;
    let reloadTime = weapon.reloadTime;
    if (!Number.isFinite(reloadTime) || reloadTime <= 0) {
      const data = this.api.cls('data.DataLocator')?.getService();
      reloadTime = Number(data?.loadKey('Weapons', weapon.key)?.reloadTime);
    }
    this.readyTime = Number.isFinite(reloadTime) && reloadTime > 0 ? shotTime + reloadTime : NaN;
    this.displayedTenths = -1;
  }

  draw(game: Raw, ship: Raw): void {
    const clip = read(ship, 'movieClip');
    if (
      Number.isNaN(this.readyTime) ||
      !ship.alive ||
      !read(ship, 'isAddedToCanvas') ||
      !clip ||
      !read(clip, 'visible') ||
      read(clip, 'alpha') <= 0 ||
      !this.api.cls('core.scene.SceneBase')?.clientSettings?.showNetherBlobBeamCountdown
    ) {
      this.hide();
      return;
    }
    if (!this.label) {
      const TextField = this.api.cls('starling.text.TextField') as any;
      const TextFormat = this.api.cls('starling.text.TextFormat') as any;
      this.label = new TextField(180, 24, '', new TextFormat('DAIDRR_COMBAT', 14, 0xffcc66));
      this.label!.set_pivotX(90);
      this.label!.set_batchable(true);
      this.label!.set_touchable(false);
    }
    // Same fractional fixed-step clock used by the port's native ship renderer.
    const alpha = Math.max(0, Math.min(1, (game.gameStateMachine?.accumulator ?? 0) / 33));
    const now = game.time + 33 * alpha;
    const tenths = Math.max(0, Math.ceil((this.readyTime - now) / 100));
    const label = this.label!;
    if (tenths !== this.displayedTenths) {
      this.displayedTenths = tenths;
      label.set_text(tenths > 0 ? `Beam ~${(tenths / 10).toFixed(1)}s` : 'Beam ready (est.)');
    }
    label.set_x(read(clip, 'x'));
    label.set_y(read(clip, 'y') - ship.radius - 30);
    label.set_alpha(read(clip, 'alpha'));
    label.set_visible(true);
    if (!read(label, 'parent')) game.canvasTexts.addChild(label);
  }

  hide(): void {
    this.label?.removeFromParent();
  }

  dispose(): void {
    this.lastShotTime = this.readyTime = NaN;
    this.displayedTenths = -1;
    this.label?.removeFromParent(true);
    this.label = undefined;
  }
}

const observations = new WeakMap<Raw, Map<Raw, NetherBlobBeamCountdown>>();
const readyGames = new WeakSet<Raw>();

/** Capture enemy packets before Haxe caches handlers or mutates shot headings. */
export function installNetherBlobBeamHooks(api: API): void {
  let packetGame: Raw | undefined;
  const manager = api.cls('core.projectile.ProjectileManager')?.prototype;
  if (typeof manager?.addEnemyProjectile === 'function')
    api.around(manager, 'addEnemyProjectile', function (next, ...args) {
      const previous = packetGame;
      packetGame = this.g;
      try {
        return next(...args);
      } finally {
        packetGame = previous;
      }
    });
  const factory = api.cls('core.projectile.ProjectileFactory');
  const enemy = api.cls('core.ship.EnemyShip')?.prototype;
  if (typeof factory?.create === 'function')
    api.before(factory, 'create', function (_type, game, owner, weapon, heading) {
      if (
        game !== packetGame ||
        !enemy?.isPrototypeOf(owner) ||
        !owner.alive ||
        owner.owner != null ||
        !owner.hasFaction('Nether') ||
        weapon?.key !== NetherBlobBeamCountdown.weaponKey ||
        !heading
      )
        return;
      let ships = observations.get(game);
      if (!ships) observations.set(game, (ships = new Map()));
      let countdown = ships.get(owner);
      if (!countdown) ships.set(owner, (countdown = new NetherBlobBeamCountdown(api)));
      countdown.observeShot(weapon, heading.time);
    });
  if (typeof enemy?.draw === 'function')
    api.after(enemy, 'draw', function () {
      if (readyGames.has(this.g)) observations.get(this.g)?.get(this)?.draw(this.g, this);
    });
  if (typeof enemy?.removeFromCanvas === 'function')
    api.before(enemy, 'removeFromCanvas', function () {
      observations.get(this.g)?.get(this)?.hide();
    });
  for (const method of ['reset', 'destroy'])
    if (typeof enemy?.[method] === 'function')
      api.before(enemy, method, function () {
        const ships = observations.get(this.g);
        ships?.get(this)?.dispose();
        ships?.delete(this);
      });
}

/** Delay text allocation until the session's combat bitmap font is available. */
export function installNetherBlobBeamCountdown(api: API, game: Raw): void {
  readyGames.add(game);
  api.defer(() => {
    readyGames.delete(game);
    for (const countdown of observations.get(game)?.values() ?? []) countdown.dispose();
    observations.delete(game);
  });
}
