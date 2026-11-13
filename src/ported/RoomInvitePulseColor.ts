// Source port of core/hud/components/RoomInvitePulseColor.as.
import type { Resolve } from '../runtime/HaxeInterop';
import type { GameScene } from '../game/Bindings';
export function createRoomInvitePulseColor(resolve: Resolve) {
  const Game: typeof GameScene = resolve('core.scene.Game');

  /** Render-only gold/red emphasis for local invitations, logins and attention notices. */

  class RoomInvitePulseColor {
    public static MARKER_COLOR: number = 0xffcc33;
    public static LABEL_PREFIX: string = '[Room invite] ';
    public static RADIO_PREFIX: string = '[Radio invite] ';
    public static LOGIN_PHRASE: string = ' logged-in to the game with QoLAF ';
    public static EMPEROR_DEFEAT_TEXT: string = 'Three Emperors were defeated!';
    private static CYCLE_MS: number = 1000;
    private static sampledAt: number = NaN;
    private static sampledColor: number = RoomInvitePulseColor.MARKER_COLOR;

    /** The caller must escape dynamic text before composition, just like MessageLog. */

    public static wrap(escapedText: string): string {
      if (escapedText == null || escapedText.length == 0) return '';
      return "<font color='#ffcc33'>" + RoomInvitePulseColor.LABEL_PREFIX + escapedText + '</font>';
    }

    public static wrapRadio(escapedText: string): string {
      return "<font color='#ffcc33'>" + RoomInvitePulseColor.RADIO_PREFIX + escapedText + '</font>';
    }

    /** Name is already escaped; version/build come from validated IPC metadata. */

    public static wrapLoginNotice(escapedName: string, version: string, build: string): string {
      if (escapedName == null || escapedName.length == 0 || version == null || build == null)
        return '';
      return (
        "<font color='#ffcc33'>" +
        escapedName +
        RoomInvitePulseColor.LOGIN_PHRASE +
        version +
        ' (' +
        build +
        ')</font>'
      );
    }

    public static wrapEmperorDefeatNotice(): string {
      return "<font color='#ffcc33'>" + RoomInvitePulseColor.EMPEROR_DEFEAT_TEXT + '</font>';
    }

    public static get currentColor(): number {
      const game = Game.instance;
      if (game == null || game.get_isLeaving() || !isFinite(game.time) || game.time <= 0) {
        return RoomInvitePulseColor.MARKER_COLOR;
      }
      let now: number = game.clock == null ? NaN : game.clock.getServerTime();
      if (!isFinite(now) || now <= 0) return RoomInvitePulseColor.MARKER_COLOR;
      if (now == RoomInvitePulseColor.sampledAt) return RoomInvitePulseColor.sampledColor;
      RoomInvitePulseColor.sampledAt = now;
      // #ffcc33 -> #ff5252 -> #ffcc33, smoothly and independently of echo.
      let blend: number =
        (1 -
          Math.cos(
            ((now % RoomInvitePulseColor.CYCLE_MS) * Math.PI * 2) / RoomInvitePulseColor.CYCLE_MS,
          )) *
        0.5;
      let green: number = Number(204 - 122 * blend + 0.5);
      let blue: number = Number(51 + 31 * blend + 0.5);
      RoomInvitePulseColor.sampledColor = 0xff0000 | (green << 8) | blue;
      return RoomInvitePulseColor.sampledColor;
    }
  }

  return RoomInvitePulseColor;
}
