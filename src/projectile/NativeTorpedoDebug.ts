import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  GameScene,
  Heading,
  MessageLog,
  PlayerManager,
  Projectile,
  ProjectileManager,
  SceneBase,
  ShipSync,
  Message,
} from '../game/Bindings';
import { observeTorpedoContacts, observeTorpedoCourses } from './TorpedoCourses';
import { installLegacyTorpedoContacts } from './LegacyTorpedoContacts';
import { TorpedoDebugRoom } from './TorpedoDebugRoom';

const rooms = new Map<GameScene, TorpedoDebugRoom>();

function correctionSetting(): boolean {
  const settings: unknown = Reflect.get(SceneBase, 'clientSettings');
  const value: unknown =
    settings && typeof settings === 'object'
      ? Reflect.get(settings, 'correctXhersixTorpedoPrediction')
      : undefined;
  return typeof value === 'boolean' ? value : true;
}

export function commandTorpedoDebug(api: API, owner: object, argument: string): void {
  const game = new GameReflection(api).cast(owner, 'core.scene.Game');
  if (!game.projectileManager || game.get_isLeaving()) return;
  try {
    let room = rooms.get(game);
    if (!room) {
      room = new TorpedoDebugRoom(game, correctionSetting);
      rooms.set(game, room);
    }
    room.command(argument);
  } catch (error) {
    MessageLog.write(
      'Torpedo debug could not start: ' + (error instanceof Error ? error.message : String(error)),
      'error',
    );
  }
}

/** Install while classes are ready, before native constructors bind packet listeners. */
export function installTorpedoDebugHooks(api: API): void {
  const reflection = new GameReflection(api);
  let spawning: { manager: ProjectileManager; message: Message; room: TorpedoDebugRoom } | null =
    null;
  reflection.around(ProjectileManager.prototype, 'addEnemyProjectile', function (next, message) {
    const room = rooms.get(this.g);
    if (!room?.recording.active) return next(message);
    const previous = spawning;
    spawning = { manager: this, message, room };
    try {
      return next(message);
    } finally {
      spawning = previous;
    }
  });
  reflection.after(Heading.prototype, 'parseMessage', function (_result, message, offset) {
    const context = spawning;
    if (!context || context.message !== message || offset < 3 || (offset - 3) % 17 !== 0) return;
    try {
      const index = offset - 3;
      const ownerId = message.getInt(index + 1);
      const weaponIndex = message.getInt(index + 2);
      const game = context.manager.g;
      const ship = game.shipManager.enemiesById.h[ownerId];
      const shipWeapon = ship?.weapons[weaponIndex];
      const turret = shipWeapon ? null : game.turretManager.getTurretById(ownerId, true);
      context.room.observer.spawn(
        message.getInt(index),
        shipWeapon ? ship : (turret ?? null),
        shipWeapon ?? turret?.weapon ?? null,
        this,
        message.getNumber(index + 16),
      );
    } catch (error) {
      context.room.recording.observerFailed(error);
    }
  });
  reflection.after(
    ProjectileManager.prototype,
    'activateProjectile',
    function (_result, projectile) {
      rooms.get(this.g)?.observer.activation(projectile);
    },
  );
  reflection.before(Projectile.prototype, 'destroy', function () {
    rooms.get(this.g)?.observer.removal(this, 'local_destroy');
  });
  let killing: { message: Message; room: TorpedoDebugRoom } | null = null;
  reflection.around(ProjectileManager.prototype, 'killProjectile', function (next, message) {
    const room = rooms.get(this.g);
    if (!room?.recording.active) return next(message);
    const previous = killing;
    killing = { message, room };
    try {
      return next(message);
    } finally {
      killing = previous;
    }
  });
  reflection.after(Message.prototype, 'getInt', function (id, index) {
    const context = killing;
    if (context && context.message === this && index >= 0 && index < this.length)
      context.room.observer.serverRemoval(id);
  });
  reflection.after(ProjectileManager.prototype, 'update', function () {
    rooms.get(this.g)?.tick();
  });
  reflection.after(GameScene.prototype, 'draw', function () {
    rooms.get(this)?.draw();
  });
  reflection.before(PlayerManager.prototype, 'damaged', function (message, offset) {
    const room = rooms.get(this.g);
    if (!room?.recording.active) return;
    try {
      room.observer.damage(
        this.get_playersById().h[message.getString(offset)] ?? null,
        message,
        offset,
      );
    } catch (error) {
      room.recording.observerFailed(error);
    }
  });
  reflection.before(PlayerManager.prototype, 'killed', function (message) {
    if (message && message.length >= 4) rooms.get(this.g)?.observer.death(message);
  });
  for (const method of ['playerCourse', 'playerUsedBoost'] as const) {
    reflection.before(ShipSync.prototype, method, function (message, offset = 0) {
      const room = rooms.get(this.g);
      if (!room?.recording.active) return;
      try {
        const player = this.g.playerManager?.get_playersById().h[message.getString(offset)];
        if (!player?.ship) return;
        const heading = new Heading();
        heading.parseMessage(message, offset + 1);
        room.observer.playerCourse(
          player,
          heading,
          method === 'playerCourse' ? 'player_course_packet' : 'player_boost_packet',
        );
      } catch (error) {
        room.recording.observerFailed(error);
      }
    });
  }
  installLegacyTorpedoContacts(
    api,
    (game) => rooms.get(game)?.recording.active ?? false,
    (projectile, target) => rooms.get(projectile.g)?.observer.contact(projectile, target, null),
    (game, error) => rooms.get(game)?.recording.observerFailed(error),
  );
  api.defer(
    observeTorpedoContacts((projectile, target, snapshot) => {
      rooms.get(projectile.g)?.observer.contact(projectile, target, snapshot);
    }),
  );
  api.defer(
    observeTorpedoCourses({
      active: (game) => rooms.get(game)?.recording.active ?? false,
      before: (projectile, message, offset, mode) =>
        rooms.get(projectile.g)?.observer.course(projectile, message, offset, mode),
      after: (projectile) => rooms.get(projectile.g)?.observer.afterCourse(projectile),
    }),
  );
  reflection.before(ProjectileManager.prototype, 'dispose', function () {
    rooms.get(this.g)?.dispose();
    rooms.delete(this.g);
  });
  api.defer(() => {
    for (const room of rooms.values()) room.dispose();
    rooms.clear();
  });
}
