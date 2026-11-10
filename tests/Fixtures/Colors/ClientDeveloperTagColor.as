package core.hud.components {
import core.scene.Game;

/** Shared server-clock hue for Client Dev labels; never changes simulation time. */
public final class ClientDeveloperTagColor {
    private static const CYCLE_MS:uint = 10000;
    private static var sampledAt:Number = NaN;
    private static var sampledColor:uint = 0xFF6666;

    public static function get currentColor():uint {
        // The reference is local to this call: never retain a departing Game.
        // time becomes positive after join/clock sync, but its fixed-step value
        // is not the animation clock. Read the continuously advancing observer.
        var game:Game = Game.instance;
        if (game == null || game.isLeaving || !isFinite(game.time) || game.time <= 0) {
            return 0xFF6666;
        }
        var now:Number = game.networkServerTime;
        if (!isFinite(now) || now <= 0) return 0xFF6666;
        if (now == sampledAt) return sampledColor;
        sampledAt = now;

        // HSV saturation 0.60, value 1: every channel stays at least 102
        // for readable pastel hues. No per-label clock, timer or allocations.
        var hue:Number = (now % CYCLE_MS) * 6 / CYCLE_MS;
        var sector:int = int(hue);
        var fraction:Number = hue - sector;
        var rising:uint = uint(102 + 153 * fraction + 0.5);
        var falling:uint = uint(255 - 153 * fraction + 0.5);
        switch (sector) {
            case 0: sampledColor = 0xFF0000 | (rising << 8) | 102; break;
            case 1: sampledColor = (falling << 16) | 0x00FF00 | 102; break;
            case 2: sampledColor = 0x66FF00 | rising; break;
            case 3: sampledColor = 0x6600FF | (falling << 8); break;
            case 4: sampledColor = (rising << 16) | 0x0066FF; break;
            default: sampledColor = 0xFF6600 | falling; break;
        }
        return sampledColor;
    }
}
}
