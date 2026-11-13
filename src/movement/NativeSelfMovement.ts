import { GameReflection } from '../api/GameReflection';
import type { API } from '../api/Types';
import { Ship, Converger, Heading, Command, Connection, type GameScene } from '../game/Bindings';
import type { BoostedPlayerShip } from '../game/BoostedPlayerShip';
import type { ReplayCommands, SelfShipSync, SelfMovementGame } from '../game/SelfMovement';
import { MovementReplay, isMovementCommand, redundantMovement } from './MovementReplay';
import { SelfCourseQueue, type SelfCourseOwner } from './SelfCourseQueue';
import { correctLocalCourse, runLocalCommand } from './LocalCorrection';
import { installNativeDeathLines } from './NativeDeathLines';
import { installNativeThrottle } from './NativeThrottle';
import { installNativeBoostHistory } from './NativeBoostHistory';

interface SelfMovementOwner extends SelfCourseOwner<Heading> {
  ship: BoostedPlayerShip;
  converger: Converger;
}

/** Source command replay and self-course reconciliation, scoped to one connected scene. */
export function installNativeSelfMovement(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const commands: ReplayCommands = game.commandManager;
  const sync: SelfShipSync = game.shipManager.shipSync;
  const diagnosticGame: SelfMovementGame = game;
  // Host around hooks run first-registered outermost. Expire boost before
  // death-line prediction replaces the native updateHeading body.
  installNativeBoostHistory(api, game);
  installNativeDeathLines(api, game);
  installNativeThrottle(
    api,
    game,
    (type, active, force) => commands.addCommand(type, active, force) === true,
  );
  const me = () => game.get_me();
  const owner = (): SelfMovementOwner | null => {
    const ship = me()?.ship;
    const converger = ship?.getConverger();
    const course = ship?.get_course();
    if (!ship || !converger || !course) return null;
    return {
      ship,
      converger,
      course,
      advance: (heading) => ship.convergerUpdateHeading(heading),
      setTarget: (heading) => converger.setConvergeTarget(heading),
      clearTarget: () => converger.clearConvergeTarget(),
    };
  };
  const replay = new MovementReplay(commands.commands);
  const queue = new SelfCourseQueue<Heading>(replay, (raw, replayed, local, override) => {
    diagnosticGame.recordHeadingDebug?.(raw, replayed, local, override);
  });
  const initial = owner();
  if (initial) replay.prepareOwner(initial.ship, initial.converger);
  const extend = <T extends object, Key extends keyof T>(
    object: T,
    name: Key,
    method: T[Key],
  ): void => {
    const previous = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { configurable: true, writable: true, value: method });
    api.defer(() => {
      if (Object.getOwnPropertyDescriptor(object, name)?.value !== method) return;
      if (previous) Object.defineProperty(object, name, previous);
      else Reflect.deleteProperty(object, name);
    });
  };
  extend(commands, 'prepareHeadingReplay', (ship: Ship, heading: Heading) =>
    replay.prepareHeading(ship, ship.getConverger(), heading),
  );
  extend(commands, 'resetMovementReplay', (ship: Ship | null = null) =>
    replay.reset(ship, ship?.getConverger() ?? null),
  );
  extend(commands, 'forceMovementReplayState', (ship: Ship | null) => {
    if (!ship) replay.reset();
    else replay.forceState(ship, ship.getConverger(), ship.get_course());
  });
  extend(sync, 'flushPendingSelfCourse', () => queue.flush(owner()));
  extend(sync, 'resetSelfCourse', (_ship: Ship | null = null, timestamp = NaN) =>
    queue.reset(owner(), timestamp),
  );

  reflection.around(
    commands,
    'addCommand',
    (_next, type: number, active: boolean, force = false) => {
      const current = owner();
      if (!current) return false;
      const ship = current.ship;
      if (type === 3 && active && (me()?.get_inSafeZone() || !ship.get_weapon())) return false;
      replay.prepareOwner(current.ship, current.converger);
      if (!force && redundantMovement(current.course, type, active)) return false;
      while (current.course.time < game.time - 66) current.advance(current.course);
      if (!Number.isNaN(replay.lastCommandTime))
        while (current.course.time < replay.lastCommandTime) current.advance(current.course);
      const command = new Command();
      command.type = type;
      command.active = active;
      command.time = current.course.time;
      replay.lastCommandTime = command.time;
      replay.store(command);
      commands.sendCommand(command);
      if (isMovementCommand(type)) runLocalCommand(current.converger, command);
      else ship.runCommand(command);
      return true;
    },
  );
  reflection.around(commands, 'runCommand', (_next, heading: Heading, time: number) =>
    replay.run(heading, time),
  );
  reflection.around(commands, 'clearCommands', (_next, time: number) => replay.clearBefore(time));
  reflection.around(commands, 'addBoostCommand', () => {
    const current = owner();
    if (!current) return;
    const ship = current.ship;
    while (current.course.time < game.time - 66) current.advance(current.course);
    if (ship.hasBoost && ship.boostNextRdy <= current.course.time && commands.addCommand(4, true)) {
      game.hud?.abilities.initiateCooldown('Engine');
      ship.boost(current.course.time);
    }
  });
  for (const method of ['playerCourse', 'playerUsedBoost'] as const) {
    reflection.around(sync, method, (next, message, offset = 0) => {
      const player = game.playerManager?.get_playersById().h[message.getString(offset)];
      if (!player?.isMe) return next(message, offset);
      const current = owner();
      if (!current || player.ship !== current.ship) return;
      const heading = new Heading();
      heading.parseMessage(message, offset + 1);
      if (method === 'playerUsedBoost') current.ship.syncBoost?.(heading.time);
      queue.queue(current, heading);
    });
  }
  reflection.around(sync, 'fastforwardMe', (_next, ship: Ship, heading: Heading) => {
    const current = owner();
    return current && current.ship === ship ? queue.fastForward(current, heading) : false;
  });
  // Game.tickUpdate sets its server time immediately before this call.
  if (game.playerManager)
    reflection.before(game.playerManager, 'update', () => queue.flush(owner()));
  reflection.around(Converger.prototype, 'calculateOffset', function (next, ...args) {
    if (this.g !== game || this.ship !== me()?.ship) return next(...args);
    if (this.course && this.target) correctLocalCourse(this);
  });
  for (const method of ['initCourse', 'set_course'] as const) {
    reflection.around(Ship.prototype, method, function (next, heading: Heading) {
      const local = this.g === game && this === me()?.ship;
      const stamp = heading?.time;
      const result = next(heading);
      if (local && heading) {
        replay.reset(this, this.getConverger());
        queue.reset(owner(), stamp);
      }
      return result;
    });
  }
  // Haxe caches bound callbacks at registration. Match that exact callback at
  // dispatch instead of replacing commandReceived after it has been captured.
  const boundReceived = reflection.bound(commands, commands.commandReceived);
  reflection.around(Connection, 'runMessageHandler', (next, type, handler, message) => {
    if (
      handler === boundReceived &&
      message.type === 'command' &&
      message.length >= 4 &&
      message.getString(0) === me()?.id &&
      isMovementCommand(message.getInt(1))
    )
      return;
    return next(type, handler, message);
  });
  api.defer(() => {
    replay.reset();
    queue.reset();
  });
}
