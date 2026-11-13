import type { API } from '../api/Types';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import type { Game } from '../game/Game';
import { GameReflection } from '../api/GameReflection';
import { cancelWeaponFire } from '../weapon/WeaponCancellation';
import {
  PlayerManager,
  PlayerShip,
  GameScene,
  GameObject,
  Player,
  TweenMax,
  Teleport,
  Heading,
  EmitterFactory,
  Emitter,
  SceneBase,
} from '../game/Bindings';

interface TeleportEmitter extends Emitter {
  retainUntilKilled?: boolean;
}

interface ScaleHandle {
  ship: PlayerShip;
  clip: Game.starling.display.MovieClip;
  player: Player | null;
  factor: number;
  applied: number;
}

/** Original optional 120ms shrink/grow transition; scaling never changes contact radius. */
export class TeleportScaleAnimation {
  private active = new Map<PlayerShip, ScaleHandle>();
  constructor(private tween: typeof TweenMax) {}
  begin(ship: PlayerShip): ScaleHandle | null {
    this.cancel(ship);
    if (!ship._mc) return null;
    const handle = { ship, clip: ship._mc, player: ship.player, factor: 1, applied: 1 };
    this.active.set(ship, handle);
    this.tween.to(handle, 0.12, { factor: 0.03, onUpdate: () => this.update(handle) });
    return handle;
  }
  finish(handle: ScaleHandle | null): void {
    if (!handle || this.active.get(handle.ship) !== handle) return;
    this.tween.killTweensOf(handle);
    handle.factor = 0.03;
    this.update(handle);
    if (this.active.get(handle.ship) !== handle) return;
    this.tween.to(handle, 0.12, {
      factor: 1,
      onUpdate: () => this.update(handle),
      onComplete: () => this.cancel(handle.ship),
    });
  }
  factor(ship: PlayerShip): number {
    return this.active.get(ship)?.applied ?? 1;
  }
  private apply(handle: ScaleHandle, factor: number): void {
    const ratio = factor / handle.applied;
    handle.clip.set_scaleX(handle.clip.get_scaleX() * ratio);
    handle.clip.set_scaleY(handle.clip.get_scaleY() * ratio);
    handle.applied = factor;
    const shadow = handle.ship.shadowImage;
    if (shadow) {
      shadow.set_scaleX(handle.clip.get_scaleX());
      shadow.set_scaleY(handle.clip.get_scaleY());
    }
  }
  private update(handle: ScaleHandle): void {
    const ship = handle.ship;
    if (this.active.get(ship) !== handle) return;
    if (
      !ship.alive ||
      ship._mc !== handle.clip ||
      ship.player !== handle.player ||
      ship.get_landed() ||
      ship.player?.isLanded ||
      ship.g.get_isLeaving()
    ) {
      this.cancel(ship);
      return;
    }
    this.apply(handle, Math.max(0.03, Math.min(1, handle.factor)));
  }
  cancel(ship: PlayerShip): void {
    const handle = this.active.get(ship);
    if (!handle) return;
    this.tween.killTweensOf(handle);
    if (ship._mc === handle.clip) this.apply(handle, 1);
    this.active.delete(ship);
  }
  cancelGame(game: GameScene): void {
    for (const ship of this.active.keys()) if (ship.g === game) this.cancel(ship);
  }
  dispose(): void {
    for (const ship of this.active.keys()) this.cancel(ship);
  }
}

function lifecycle(ship: RenderedGameObject): number {
  return ship.get_lifecycleId?.() ?? 0;
}

interface TeleportToken {
  lifecycle: number;
  phase: 0 | 1 | 2;
  manager: PlayerManager;
  ship: PlayerShip;
  player: Player;
  id: string;
  timer?: TweenMax;
  markers: Array<{ emitter: TeleportEmitter; generation: number }>;
  visual: ScaleHandle | null;
}

export function installTeleportAnimation(api: API): void {
  const reflection = new GameReflection(api);
  const manager = PlayerManager.prototype;
  const ship = PlayerShip.prototype;
  const game = GameScene.prototype;
  const Tween = TweenMax;
  const Factory = EmitterFactory;
  const animation = new TeleportScaleAnimation(Tween);
  const visual = (run: () => void) => {
    try {
      run();
    } catch (error) {
      api.log('Teleport presentation failed', error);
    }
  };
  const pending = new Map<PlayerShip, TeleportToken>();
  const generations = new WeakMap<Emitter, number>();
  const emitter = Emitter.prototype;
  // Native emitters return to their pool through dispose, not reset.
  reflection.before(emitter, 'dispose', function () {
    generations.set(this, (generations.get(this) ?? 0) + 1);
  });
  const effect = (
    key: string,
    g: GameScene,
    x: number,
    y: number,
    target: GameObject | null,
  ): TeleportEmitter[] => {
    try {
      return Factory.create(key, g, x, y, target, true) ?? [];
    } catch (error) {
      api.log('Teleport visual effect failed', error);
      return [];
    }
  };
  const cleanupMarkers = (token: TeleportToken) => {
    const g = token.manager.g;
    if (!g.get_isLeaving() && g.playerManager === token.manager)
      for (const { emitter, generation } of token.markers)
        if ((generations.get(emitter) ?? 0) === generation) visual(() => emitter.killEmitter());
    token.markers.length = 0;
  };
  const cancelToken = (token: TeleportToken) => {
    if (token.phase === 2) return;
    token.phase = 2;
    token.timer?.kill();
    visual(() => cleanupMarkers(token));
    if (pending.get(token.ship) === token) {
      pending.delete(token.ship);
      visual(() => animation.cancel(token.ship));
    }
  };
  const cancel = (target: PlayerShip) => {
    const token = pending.get(target);
    if (token) cancelToken(token);
    else visual(() => animation.cancel(target));
  };
  const current = (token: TeleportToken): boolean => {
    const g = token.manager.g,
      player = token.player,
      target = token.ship;
    return (
      pending.get(target) === token &&
      !g.get_isLeaving() &&
      g.playerManager === token.manager &&
      token.manager.get_playersById().h[token.id] === player &&
      player.ship === target &&
      lifecycle(target) === token.lifecycle &&
      target.alive &&
      !target.get_landed() &&
      !player.isLanded
    );
  };
  reflection.around(manager, 'm_teleportToPosition', function (_next, message) {
    const g = this.g;
    if (!message || g.get_isLeaving() || g.playerManager !== this) return;
    try {
      const id = message.getString(0),
        deadline = message.getNumber(1);
      const player = this.get_playersById().h[id],
        target = player?.ship;
      if (!Number.isFinite(deadline) || !player || !target?.alive) return;
      const stop = new Heading();
      const offset = stop.parseMessage(message, 2);
      const destination = new Heading();
      destination.parseMessage(message, offset);
      cancel(target);
      const token: TeleportToken = {
        lifecycle: lifecycle(target),
        phase: 0,
        manager: this,
        ship: target,
        player,
        id,
        markers: [],
        visual: null,
      };
      pending.set(target, token);
      const animate = !!SceneBase.clientSettings?.animateTeleportScaling;
      target.isTeleporting = true;
      const weapon = target.get_weapon();
      if (weapon && weapon.get_fire()) cancelWeaponFire(weapon);
      for (const weapon of target.weapons)
        for (const projectile of weapon.projectiles) projectile.ttl = 0;
      if (weapon instanceof Teleport) weapon.updateCooldown();
      target.channelingEnd = deadline;
      target.set_course(stop);
      const position = () => target.get_pos();
      effect('UZ3AiNHAEUmBD4ev0Itu0A', g, position().x, position().y, target);
      token.markers = effect(
        '5BSaDIEYj0mEuVkMVp1JGw',
        g,
        destination.pos.x,
        destination.pos.y,
        null,
      ).map((emitter) => {
        // Source PlayerManager retains destination markers until completion or
        // cancellation, even when their finite particle burst has already ended.
        emitter.retainUntilKilled = true;
        return { emitter, generation: generations.get(emitter) ?? 0 };
      });
      const finish = () => {
        if (token.phase !== 1) return;
        if (!current(token)) {
          cancelToken(token);
          return;
        }
        token.phase = 2;
        pending.delete(target);
        visual(() => cleanupMarkers(token));
        target.set_course(destination);
        target.isTeleporting = false;
        visual(() => animation.finish(token.visual));
        if (target === g.get_me()?.ship) {
          g.focusGameObject(target, true);
          effect('CBZIObPQ40uaMZGvEcHvjw', g, position().x, position().y, target);
        }
      };
      const transition = () => {
        if (token.phase !== 0) return;
        if (!current(token)) {
          cancelToken(token);
          return;
        }
        token.phase = 1;
        visual(() => g.emitterManager?.clean(target));
        effect('CBZIObPQ40uaMZGvEcHvjw', g, position().x, position().y, target);
        token.timer = Tween.delayedCall(animate ? 0.12 : 0.24, finish);
        if (animate)
          visual(() => {
            token.visual = animation.begin(target);
          });
      };
      const delay = Math.max(0, (deadline - g.time) / 1000);
      if (delay === 0) transition();
      else token.timer = Tween.delayedCall(delay, transition);
    } catch (error) {
      api.log('Teleport transition failed', error);
    }
  });
  reflection.around(ship, 'get_radius', function (next) {
    return next() / animation.factor(this);
  });
  const previousScale = Object.getOwnPropertyDescriptor(ship, 'get_teleportVisualScale');
  Object.defineProperty(ship, 'get_teleportVisualScale', {
    configurable: true,
    writable: true,
    value: function (this: PlayerShip) {
      return animation.factor(this);
    },
  });
  api.defer(() => {
    if (previousScale) Object.defineProperty(ship, 'get_teleportVisualScale', previousScale);
    else Reflect.deleteProperty(ship, 'get_teleportVisualScale');
  });
  for (const method of ['reset', 'destroy', 'switchTexturesByObj', 'land'] as const)
    if (typeof ship[method] === 'function')
      reflection.before(ship, method, function () {
        cancel(this);
      });
  reflection.before(game, 'exit', function () {
    for (const [target, token] of pending) if (token.manager.g === this) cancel(target);
    animation.cancelGame(this);
  });
  api.defer(() => {
    for (const target of pending.keys()) cancel(target);
    animation.dispose();
  });
}
