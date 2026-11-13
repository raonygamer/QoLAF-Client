import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Converger, PlayerShip, type GameScene } from '../game/Bindings';
import type { IncomingPlayer } from '../game/IncomingPlayer';
import { crossesDeathLine } from './DeathLineCollision';

/** Sweep predicted steps, including replay; never reject an authoritative position assignment. */
export function installNativeDeathLines(api: API, game: GameScene): void {
  const reflection = new GameReflection(api);
  const localShip = () => game.get_me()?.ship;
  reflection.around(Converger.prototype, 'updateHeading', function (next, heading) {
    const ship = this.ship;
    if (
      this.g !== game ||
      ship !== localShip() ||
      !(ship instanceof PlayerShip) ||
      !ship.player?.isMe ||
      ship.player.get_isWarpJumping() ||
      !game.deathLineManager
    )
      return next(heading);
    const startX = heading.pos.x,
      startY = heading.pos.y,
      startTime = heading.time;
    const result = next(heading);
    for (const line of game.deathLineManager.lines) {
      const geometry = { x: line.get_x(), y: line.get_y(), toX: line.toX, toY: line.toY };
      if (
        !crossesDeathLine(
          geometry,
          heading.pos.x,
          heading.pos.y,
          startX,
          startY,
          ship.collisionRadius,
        )
      )
        continue;
      // Source records only recent live contacts, never replay or speculative contacts.
      if (
        heading === this.course &&
        ship.alive &&
        !ship.player.isLanded &&
        Number.isFinite(startTime) &&
        startTime <= game.time &&
        game.time - startTime <= 66
      ) {
        const player: IncomingPlayer = ship.player;
        player.recordDeathLineContact?.(
          geometry.x,
          geometry.y,
          geometry.toX,
          geometry.toY,
          startX,
          startY,
        );
      }
      heading.pos.x = startX;
      heading.pos.y = startY;
      heading.speed.x = heading.speed.y = 0;
      break;
    }
    return result;
  });
  reflection.around(PlayerShip.prototype, 'updateHeading', function (next, ...args) {
    if (this.g !== game || this !== localShip()) return next(...args);
    if (!this.alive || !this.get_course()) return;
    // The boost adapter wraps this method and handles expiry before entering it.
    // Remove native lastSafeX/Y rollback: it can reject a new authoritative transform.
    this.runConverger();
    const course = this.get_course();
    if (!course || !this.engine) return;
    if (course.accelerate) this.engine.accelerate();
    else this.engine.idle();
  });
}
