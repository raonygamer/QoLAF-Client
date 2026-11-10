package core.hud.components {
import core.scene.Game;

/** Shared server-clock violet/electric-blue pulse for marked echo labels. */
public final class EchoPulseColor {
    public static const MARKER_COLOR:uint = 0x9B5CFF;
    private static const CYCLE_MS:Number = 1000;
    private static var sampledAt:Number = NaN;
    private static var sampledColor:uint = MARKER_COLOR;

    public static function get currentColor():uint {
        // Only borrow the current room for this read. Game.time is a sync
        // readiness guard, not the fixed-step clock used to animate the label.
        var game:Game = Game.instance;
        if (game == null || game.isLeaving || !isFinite(game.time) || game.time <= 0) {
            return MARKER_COLOR;
        }

        var now:Number = game.networkServerTime;
        if (!isFinite(now) || now <= 0) {
            return MARKER_COLOR;
        }

        if (now == sampledAt) {
            return sampledColor;
        }

        sampledAt = now;

        // #9B5CFF -> #28B8FF -> #9B5CFF, with zero slope at each end.
        var blend:Number =
                (1 - Math.cos((now % CYCLE_MS) * Math.PI * 2 / CYCLE_MS)) * 0.5;

        var red:uint = uint(155 - 115 * blend + 0.5);
        var green:uint = uint(92 + 92 * blend + 0.5);
        var blue:uint = 255;

        sampledColor = (red << 16) | (green << 8) | blue;
        return sampledColor;
    }
}
}