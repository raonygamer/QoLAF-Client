package core.hud.components {
import core.scene.Game;

/** Render-only gold/red emphasis for local invitations, logins and attention notices. */
public final class RoomInvitePulseColor {
    public static const MARKER_COLOR:uint = 0xffcc33;
    public static const LABEL_PREFIX:String = "[Room invite] ";
    public static const RADIO_PREFIX:String = "[Radio invite] ";
    public static const LOGIN_PHRASE:String = " logged-in to the game with QoLAF ";
    public static const EMPEROR_DEFEAT_TEXT:String = "Three Emperors were defeated!";
    private static const CYCLE_MS:Number = 1000;
    private static var sampledAt:Number = NaN;
    private static var sampledColor:uint = MARKER_COLOR;

    /** The caller must escape dynamic text before composition, just like MessageLog. */
    public static function wrap(escapedText:String):String {
        if (escapedText == null || escapedText.length == 0) return "";
        return "<font color='#ffcc33'>" + LABEL_PREFIX + escapedText + "</font>";
    }

    public static function wrapRadio(escapedText:String):String {
        return "<font color='#ffcc33'>" + RADIO_PREFIX + escapedText + "</font>";
    }

    /** Name is already escaped; version/build come from validated IPC metadata. */
    public static function wrapLoginNotice(escapedName:String, version:String, build:String):String {
        if (escapedName == null || escapedName.length == 0 || version == null || build == null) return "";
        return "<font color='#ffcc33'>" + escapedName + LOGIN_PHRASE + version + " (" + build + ")</font>";
    }

    public static function wrapEmperorDefeatNotice():String {
        return "<font color='#ffcc33'>" + EMPEROR_DEFEAT_TEXT + "</font>";
    }

    public static function get currentColor():uint {
        var game:Game = Game.instance;
        if (game == null || game.isLeaving || !isFinite(game.time) || game.time <= 0) {
            return MARKER_COLOR;
        }
        var now:Number = game.networkServerTime;
        if (!isFinite(now) || now <= 0) return MARKER_COLOR;
        if (now == sampledAt) return sampledColor;
        sampledAt = now;
        // #ffcc33 -> #ff5252 -> #ffcc33, smoothly and independently of echo.
        var blend:Number = (1 - Math.cos((now % CYCLE_MS) * Math.PI * 2 / CYCLE_MS)) * 0.5;
        var green:uint = uint(204 - 122 * blend + 0.5);
        var blue:uint = uint(51 + 31 * blend + 0.5);
        sampledColor = 0xff0000 | (green << 8) | blue;
        return sampledColor;
    }
}
}
