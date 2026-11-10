package core.hud.components {
import core.scene.Game;

/** Chat-only reward celebration; lower-level relics have a separate cyan/teal pulse. */
public final class PodRewardPulseColor {
    public static const MARKER_COLOR:uint = 0xff4b85;
    public static const LOW_RELIC_MARKER_COLOR:uint = 0x43efdf;
    private static const CYCLE_MS:Number = 1600;
    private static var sampledAt:Number = NaN;
    private static var sampledColor:uint = MARKER_COLOR;
    private static var sampledLowRelicColor:uint = LOW_RELIC_MARKER_COLOR;

    public static function wrap(escapedText:String, lowRelic:Boolean = false):String {
        return (lowRelic ? "<font color='#43efdf'>" : "<font color='#ff4b85'>") + escapedText + "</font>";
    }

    public static function isNoticeText(text:String):Boolean {
        return text != null && (/^.+ received .+ from a pod!$/.test(text) ||
                /^.+ got an? .+!$/.test(text) || /^.+ just bought .+!$/.test(text));
    }

    public static function colorAt(time:Number, lowRelic:Boolean = false):uint {
        if (!isFinite(time) || time <= 0) return lowRelic ? LOW_RELIC_MARKER_COLOR : MARKER_COLOR;
        var blend:Number = (1 - Math.cos((time % CYCLE_MS) * Math.PI * 2 / CYCLE_MS)) * 0.5;
        if (lowRelic) return (uint(75 - 17 * blend + 0.5) << 16) | (uint(221 + 34 * blend + 0.5) << 8) |
            uint(255 - 54 * blend + 0.5);
        return (uint(255 - 15 * blend + 0.5) << 16) | 0x004b00 |
                uint(85 + 170 * blend + 0.5);
    }

    public static function get currentColor():uint {
        sampleColors();
        return sampledColor;
    }

    public static function get currentLowRelicColor():uint {
        sampleColors();
        return sampledLowRelicColor;
    }

    private static function sampleColors():void {
        var game:Game = Game.instance;
        if (game == null || game.isLeaving || game.time <= 0) {
            sampledAt = NaN;
            sampledColor = MARKER_COLOR;
            sampledLowRelicColor = LOW_RELIC_MARKER_COLOR;
            return;
        }
        var now:Number = game.networkServerTime;
        if (now != sampledAt) {
            sampledAt = now;
            sampledColor = colorAt(now);
            sampledLowRelicColor = colorAt(now, true);
        }
    }
}
}
