import { correctRemoteCourse } from '../movement/RemoteCorrection';
import { RemoteMovementBuffer, type RemoteMovementState } from '../movement/RemoteMovementBuffer';
import type { MovementCommand } from '../movement/MovementReplay';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Ship,
  PlayerShip,
  ShipSync,
  Converger,
  Heading,
  type Player,
  type Engine,
} from '../game/Bindings';
import type { BoostedPlayerShip } from '../game/BoostedPlayerShip';
import { RemoteRotationBuffer, type RotationHeading } from './RemoteRotationBuffer';

/** Only the native state needed by the playback buffers. */
interface RemoteShipState {
  player?: Pick<Player, 'isMe' | 'isLanded' | 'get_isWarpJumping'> | null;
  engine: Pick<Engine, 'get_rotationSpeed'> | null;
  alive: boolean;
  forcedRotation?: boolean;
  isTeleporting?: boolean;
  stateMachine: { inState(state: string): boolean };
  get_landed?(): boolean;
  get_course?(): (RemoteMovementState & { time: number }) | null;
}

/** PlayerShip's rotation history belongs to the ship, never to a pooled heading. */
export class RemoteShips {
  private movements = new WeakMap<RemoteShipState, RemoteMovementBuffer>();
  private rotations = new WeakMap<RemoteShipState, RemoteRotationBuffer>();

  constructor(private readonly now: () => number = () => performance.now()) {}

  observe(ship: RemoteShipState, heading: RotationHeading & Partial<RemoteMovementState>): boolean {
    if (!ship.player || ship.player.isMe || !ship.engine) return true;
    let buffer = this.rotations.get(ship);
    if (!buffer) {
      buffer = new RemoteRotationBuffer();
      this.rotations.set(ship, buffer);
    }
    const now = this.now();
    if (!buffer.add(heading, now, ship.engine.get_rotationSpeed())) return false;
    let movement = this.movements.get(ship);
    if (!movement) this.movements.set(ship, (movement = new RemoteMovementBuffer()));
    movement.addHeading(
      {
        time: heading.time,
        accelerate: !!heading.accelerate,
        deaccelerate: !!heading.deaccelerate,
      },
      now,
    );
    return true;
  }

  reset(ship: RemoteShipState, heading?: RotationHeading): void {
    this.rotations.delete(ship);
    this.movements.delete(ship);
    if (heading) this.observe(ship, heading);
  }

  observeCommand(ship: RemoteShipState, command: MovementCommand): boolean {
    if (!ship.player || ship.player.isMe) return false;
    let movement = this.movements.get(ship);
    const now = this.now();
    if (!movement) {
      this.movements.set(ship, (movement = new RemoteMovementBuffer()));
      const course = ship.get_course?.();
      if (course) movement.addHeading(course, now);
    }
    return movement.addCommand(command, now);
  }

  applyMovement(ship: RemoteShipState, heading: RemoteMovementState | null): boolean {
    if (
      !heading ||
      !ship.player ||
      ship.player.isMe ||
      !ship.alive ||
      ship.get_landed?.() ||
      ship.player.isLanded ||
      ship.player.get_isWarpJumping() ||
      ship.isTeleporting ||
      !ship.stateMachine?.inState('Roaming')
    )
      return false;
    const movement = this.movements.get(ship)?.sample(this.now());
    if (!movement) return false;
    heading.accelerate = movement.accelerate;
    heading.deaccelerate = movement.deaccelerate;
    return true;
  }

  sample(ship: RemoteShipState): number {
    if (
      !ship.player ||
      ship.player.isMe ||
      !ship.alive ||
      ship.get_landed?.() ||
      ship.player.isLanded ||
      ship.player.get_isWarpJumping() ||
      ship.isTeleporting ||
      ship.forcedRotation ||
      !ship.stateMachine?.inState('Roaming')
    )
      return NaN;
    return this.rotations.get(ship)?.sample(this.now()) ?? NaN;
  }
}

/** Observe packet headings before Converger can extrapolate them in place. */
export function installRemoteShips(api: API): RemoteShips {
  const remote = new RemoteShips();
  const reflection = new GameReflection(api);
  const sync = ShipSync.prototype;
  const ship = Ship.prototype;
  const playerShip = PlayerShip.prototype;
  const converger = Converger.prototype;

  for (const method of ['playerCourse', 'playerUsedBoost'] as const) {
    reflection.around(sync, method, function (next, message, offset = 0) {
      const players = this.g.playerManager?.get_playersById();
      const player = players?.h[message.getString(offset)];
      const target: BoostedPlayerShip | null | undefined = player?.ship;
      if (!player || !target || player.isMe || !target.getConverger() || !target.get_course()) {
        return next(message, offset);
      }
      const heading = new Heading();
      heading.parseMessage(message, offset + 1);
      const boost = method === 'playerUsedBoost';
      // An old boost event still confirms its timing, but cannot replace a newer pose.
      if (boost && Number.isFinite(heading.time)) {
        if (typeof target.syncBoost === 'function') target.syncBoost(heading.time);
        else target.boost();
      }
      if (!remote.observe(target, heading)) return;
      const course = target.get_course();
      if (!course) return;
      course.rotateLeft = boost ? false : heading.rotateLeft;
      course.rotateRight = boost ? false : heading.rotateRight;
      target.getConverger().setConvergeTarget(heading);
    });
  }
  for (const method of ['initCourse', 'set_course'] as const) {
    reflection.before(ship, method, function (heading) {
      if (this instanceof PlayerShip && heading && this.get_course()) remote.reset(this, heading);
    });
  }
  for (const method of ['reset', 'destroy', 'land', 'enterWarpJump'] as const) {
    reflection.before(playerShip, method, function () {
      remote.reset(this);
    });
  }
  reflection.around(playerShip, 'runCommand', function (next, command) {
    if ([0, 8, 4].includes(command.type) && remote.observeCommand(this, command)) return;
    return next(command);
  });
  reflection.around(converger, 'calculateOffset', function (next, ...args) {
    if (!(this.ship instanceof PlayerShip) || !this.ship.player || this.ship.player.isMe)
      return next(...args);
    correctRemoteCourse(this, Number.isFinite(remote.sample(this.ship)));
  });
  reflection.before(converger, 'run', function () {
    if (this.ship instanceof PlayerShip) remote.applyMovement(this.ship, this.course);
  });
  reflection.after(converger, 'run', function () {
    if (this.ship instanceof PlayerShip) remote.applyMovement(this.ship, this.course);
    const angle = this.ship instanceof PlayerShip ? remote.sample(this.ship) : NaN;
    if (this.course && Number.isFinite(angle)) this.course.rotation = angle;
  });
  return remote;
}
