// Source port of core/hud/components/EchoPulseColor.as.
import type { Resolve } from '../runtime/As3';
import { read } from '../api/Types';
export function createEchoPulseColor(resolve: Resolve): any {
  const Game: any = resolve('core.scene.Game');
  type Game = any;

  /** Shared server-clock violet/electric-blue pulse for marked echo labels. */

  class EchoPulseColor {
    public static MARKER_COLOR: number = 0x9b5cff;
    private static CYCLE_MS: number = 1000;
    private static sampledAt: number = NaN;
    private static sampledColor: number = EchoPulseColor.MARKER_COLOR;

    public static get currentColor(): number {
      // Only borrow the current room for this read. Game.time is a sync
      // readiness guard, not the fixed-step clock used to animate the label.
      let game: Game = Game.instance;
      if (
        game == null ||
        read(game, 'isLeaving', false) ||
        !isFinite(game.time) ||
        game.time <= 0
      ) {
        return EchoPulseColor.MARKER_COLOR;
      }

      let now: number = game.clock == null ? NaN : game.clock.getServerTime();
      if (!isFinite(now) || now <= 0) {
        return EchoPulseColor.MARKER_COLOR;
      }

      if (now == EchoPulseColor.sampledAt) {
        return EchoPulseColor.sampledColor;
      }

      EchoPulseColor.sampledAt = now;

      // #9B5CFF -> #28B8FF -> #9B5CFF, with zero slope at each end.
      let blend: number =
        (1 - Math.cos(((now % EchoPulseColor.CYCLE_MS) * Math.PI * 2) / EchoPulseColor.CYCLE_MS)) *
        0.5;

      let red: number = Number(155 - 115 * blend + 0.5);
      let green: number = Number(92 + 92 * blend + 0.5);
      let blue: number = 255;

      EchoPulseColor.sampledColor = (red << 16) | (green << 8) | blue;
      return EchoPulseColor.sampledColor;
    }
  }

  return EchoPulseColor;
}
