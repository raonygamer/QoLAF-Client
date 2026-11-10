// Source port of core/hud/components/ClientDeveloperTagColor.as.
import type { Resolve } from '../runtime/As3';
import { read } from '../api/Types';
export function createClientDeveloperTagColor(resolve: Resolve): any {
  const Game: any = resolve('core.scene.Game');
  type Game = any;

  /** Shared server-clock hue for Client Dev labels; never changes simulation time. */

  class ClientDeveloperTagColor {
    private static CYCLE_MS: number = 10000;
    private static sampledAt: number = NaN;
    private static sampledColor: number = 0xff6666;

    public static get currentColor(): number {
      // The reference is local to this call: never retain a departing Game.
      // time becomes positive after join/clock sync, but its fixed-step value
      // is not the animation clock. Read the continuously advancing observer.
      let game: Game = Game.instance;
      if (
        game == null ||
        read(game, 'isLeaving', false) ||
        !isFinite(game.time) ||
        game.time <= 0
      ) {
        return 0xff6666;
      }
      let now: number = game.clock == null ? NaN : game.clock.getServerTime();
      if (!isFinite(now) || now <= 0) return 0xff6666;
      if (now == ClientDeveloperTagColor.sampledAt) return ClientDeveloperTagColor.sampledColor;
      ClientDeveloperTagColor.sampledAt = now;

      // HSV saturation 0.60, value 1: every channel stays at least 102
      // for readable pastel hues. No per-label clock, timer or allocations.
      let hue: number =
        ((now % ClientDeveloperTagColor.CYCLE_MS) * 6) / ClientDeveloperTagColor.CYCLE_MS;
      let sector: number = Math.trunc(hue);
      let fraction: number = hue - sector;
      let rising: number = Number(102 + 153 * fraction + 0.5);
      let falling: number = Number(255 - 153 * fraction + 0.5);
      switch (sector) {
        case 0:
          ClientDeveloperTagColor.sampledColor = 0xff0000 | (rising << 8) | 102;
          break;
        case 1:
          ClientDeveloperTagColor.sampledColor = (falling << 16) | 0x00ff00 | 102;
          break;
        case 2:
          ClientDeveloperTagColor.sampledColor = 0x66ff00 | rising;
          break;
        case 3:
          ClientDeveloperTagColor.sampledColor = 0x6600ff | (falling << 8);
          break;
        case 4:
          ClientDeveloperTagColor.sampledColor = (rising << 16) | 0x0066ff;
          break;
        default:
          ClientDeveloperTagColor.sampledColor = 0xff6600 | falling;
          break;
      }
      return ClientDeveloperTagColor.sampledColor;
    }
  }

  return ClientDeveloperTagColor;
}
