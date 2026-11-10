import { read, type API, type Raw } from '../api/Types';
import { RemoteRotationBuffer, type RotationHeading } from './RemoteRotationBuffer';

/** PlayerShip's rotation history belongs to the ship, never to a pooled heading. */
export class RemoteShips {
  private rotations = new WeakMap<Raw, RemoteRotationBuffer>();

  constructor(private readonly now: () => number = () => performance.now()) {}

  observe(ship: Raw, heading: RotationHeading): boolean {
    if (!ship.player || ship.player.isMe || !ship.engine) return true;
    let buffer = this.rotations.get(ship);
    if (!buffer) {
      buffer = new RemoteRotationBuffer();
      this.rotations.set(ship, buffer);
    }
    return buffer.add(heading, this.now(), read(ship.engine, 'rotationSpeed'));
  }

  reset(ship: Raw, heading?: RotationHeading): void {
    this.rotations.delete(ship);
    if (heading) this.observe(ship, heading);
  }

  sample(ship: Raw): number {
    if (
      !ship.player ||
      ship.player.isMe ||
      !ship.alive ||
      read(ship, 'landed') ||
      ship.player.isLanded ||
      ship.player.isWarpJumping ||
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
  const sync = api.cls('core.ship.ShipSync')?.prototype;
  const ship = api.cls('core.ship.Ship')?.prototype;
  const playerShip = api.cls('core.ship.PlayerShip')?.prototype;
  const converger = api.cls('core.sync.Converger')?.prototype;
  const Heading = api.cls('movement.Heading') as any;
  if (!sync || !ship || !playerShip || !converger || !Heading) {
    api.log('Remote rotation hooks unavailable: missing upstream movement classes');
    return remote;
  }

  for (const method of ['playerCourse', 'playerUsedBoost']) {
    api.around(sync, method, function (next, message, offset = 0) {
      const players = read(this.g.playerManager, 'playersById');
      const player = players.h[message.getString(offset)];
      const target = player?.ship;
      if (!target || player.isMe || !target.getConverger() || !read(target, 'course')) {
        return next(message, offset);
      }
      const heading = new Heading();
      heading.parseMessage(message, offset + 1);
      // Preserve the upstream boost event even if its pose is older. Boost's
      // timestamp reconciliation is a separate source port from visual rotation.
      if (!remote.observe(target, heading) && method === 'playerCourse') return;
      return next(message, offset);
    });
  }
  for (const method of ['initCourse', 'set_course']) {
    api.before(ship, method, function (heading) {
      if (heading && read(this, 'course')) remote.reset(this, heading);
    });
  }
  for (const method of ['reset', 'destroy', 'land', 'enterWarpJump']) {
    api.before(playerShip, method, function () {
      remote.reset(this);
    });
  }
  api.after(converger, 'run', function () {
    const angle = remote.sample(this.ship);
    if (this.course && Number.isFinite(angle)) this.course.rotation = angle;
  });
  return remote;
}
