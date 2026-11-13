import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  DataLocator,
  EnemyShip,
  ProjectileFactory,
  ProjectileManager,
  SceneBase,
  StarlingTextField,
  TextFormat,
  type GameScene,
  type Weapon,
} from '../game/Bindings';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';

/** Original observed-shot estimate; never predicts or changes an enemy attack. */
export class NetherBlobBeamCountdown {
  static readonly weaponKey = '222ekuHQxE6j9IOXMVXs6g';
  private lastShotTime = NaN;
  private readyTime = NaN;
  private displayedTenths = -1;
  private label?: StarlingTextField;

  observeShot(weapon: Pick<Weapon, 'key' | 'reloadTime'> | null, shotTime: number): void {
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
      const definition = DataLocator.getService()?.loadKey('Weapons', weapon.key);
      reloadTime = Number(
        definition && typeof definition === 'object' && 'reloadTime' in definition
          ? definition.reloadTime
          : NaN,
      );
    }
    this.readyTime = Number.isFinite(reloadTime) && reloadTime > 0 ? shotTime + reloadTime : NaN;
    this.displayedTenths = -1;
  }

  draw(game: GameScene, ship: EnemyShip): void {
    const clip = ship.get_movieClip();
    if (
      Number.isNaN(this.readyTime) ||
      !ship.alive ||
      !ship.isAddedToCanvas ||
      !clip ||
      !clip.get_visible() ||
      clip.get_alpha() <= 0 ||
      !SceneBase.clientSettings?.showNetherBlobBeamCountdown
    ) {
      this.hide();
      return;
    }
    if (!this.label) {
      this.label = new StarlingTextField(
        180,
        24,
        '',
        new TextFormat(RussoBitmapFontRegistry.COMBAT_FONT_NAME, 14, 0xffcc66),
      );
      this.label.set_pivotX(90);
      this.label.set_batchable(true);
      this.label.set_touchable(false);
    }
    // Same fractional fixed-step clock used by the port's native ship renderer.
    const alpha = Math.max(0, Math.min(1, (game.gameStateMachine?.accumulator ?? 0) / 33));
    const now = game.time + 33 * alpha;
    const tenths = Math.max(0, Math.ceil((this.readyTime - now) / 100));
    const label = this.label;
    if (tenths !== this.displayedTenths) {
      this.displayedTenths = tenths;
      label.set_text(tenths > 0 ? `Beam ~${(tenths / 10).toFixed(1)}s` : 'Beam ready (est.)');
    }
    label.set_x(clip.get_x());
    label.set_y(clip.get_y() - ship.get_radius() - 30);
    label.set_alpha(clip.get_alpha());
    label.set_visible(true);
    if (!label.get_parent()) game.canvasTexts.addChild(label);
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

const observations = new WeakMap<GameScene, Map<EnemyShip, NetherBlobBeamCountdown>>();
const readyGames = new WeakSet<GameScene>();

/** Capture enemy packets before Haxe caches handlers or mutates shot headings. */
export function installNetherBlobBeamHooks(api: API): void {
  let packetGame: GameScene | undefined;
  const reflection = new GameReflection(api);
  const manager = ProjectileManager.prototype;
  if (typeof manager?.addEnemyProjectile === 'function')
    reflection.around(manager, 'addEnemyProjectile', function (next, ...args) {
      const previous = packetGame;
      packetGame = this.g;
      try {
        return next(...args);
      } finally {
        packetGame = previous;
      }
    });
  const factory = ProjectileFactory;
  const enemy = EnemyShip.prototype;
  if (typeof factory?.create === 'function')
    reflection.before(factory, 'create', function (_type, game, owner, weapon, heading) {
      if (
        game !== packetGame ||
        !(owner instanceof EnemyShip) ||
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
      if (!countdown) ships.set(owner, (countdown = new NetherBlobBeamCountdown()));
      countdown.observeShot(weapon, heading.time);
    });
  if (typeof enemy?.draw === 'function')
    reflection.after(enemy, 'draw', function () {
      if (readyGames.has(this.g)) observations.get(this.g)?.get(this)?.draw(this.g, this);
    });
  if (typeof enemy?.removeFromCanvas === 'function')
    reflection.before(enemy, 'removeFromCanvas', function () {
      observations.get(this.g)?.get(this)?.hide();
    });
  for (const method of ['reset', 'destroy'] as const)
    if (typeof enemy?.[method] === 'function')
      reflection.before(enemy, method, function () {
        const ships = observations.get(this.g);
        ships?.get(this)?.dispose();
        ships?.delete(this);
      });
}

/** Delay text allocation until the session's combat bitmap font is available. */
export function installNetherBlobBeamCountdown(api: API, game: GameScene): void {
  readyGames.add(game);
  api.defer(() => {
    readyGames.delete(game);
    for (const countdown of observations.get(game)?.values() ?? []) countdown.dispose();
    observations.delete(game);
  });
}
