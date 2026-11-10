// Source port of core/hud/components/PodRewardPulseColor.as.
import type { Resolve } from '../Runtime/As3';
import { read } from '../Api/Types';
export function createPodRewardPulseColor(resolve: Resolve): any {
  const Game: any = resolve('core.scene.Game');
  type Game = any;

  /** Chat-only reward celebration; lower-level relics have a separate cyan/teal pulse. */

  class PodRewardPulseColor {
    public static MARKER_COLOR: number = 0xff4b85;
    public static LOW_RELIC_MARKER_COLOR: number = 0x43efdf;
    private static CYCLE_MS: number = 1600;
    private static sampledAt: number = NaN;
    private static sampledColor: number = PodRewardPulseColor.MARKER_COLOR;
    private static sampledLowRelicColor: number = PodRewardPulseColor.LOW_RELIC_MARKER_COLOR;

    public static wrap(escapedText: string, lowRelic: boolean = false): string {
      return (
        (lowRelic ? "<font color='#43efdf'>" : "<font color='#ff4b85'>") + escapedText + '</font>'
      );
    }

    public static isNoticeText(text: string): boolean {
      return (
        text != null &&
        (/^.+ received .+ from a pod!$/.test(text) ||
          /^.+ got an? .+!$/.test(text) ||
          /^.+ just bought .+!$/.test(text))
      );
    }

    public static colorAt(time: number, lowRelic: boolean = false): number {
      if (!isFinite(time) || time <= 0)
        return lowRelic
          ? PodRewardPulseColor.LOW_RELIC_MARKER_COLOR
          : PodRewardPulseColor.MARKER_COLOR;
      let blend: number =
        (1 -
          Math.cos(
            ((time % PodRewardPulseColor.CYCLE_MS) * Math.PI * 2) / PodRewardPulseColor.CYCLE_MS,
          )) *
        0.5;
      if (lowRelic)
        return (
          (Number(75 - 17 * blend + 0.5) << 16) |
          (Number(221 + 34 * blend + 0.5) << 8) |
          Number(255 - 54 * blend + 0.5)
        );
      return (Number(255 - 15 * blend + 0.5) << 16) | 0x004b00 | Number(85 + 170 * blend + 0.5);
    }

    public static get currentColor(): number {
      PodRewardPulseColor.sampleColors();
      return PodRewardPulseColor.sampledColor;
    }

    public static get currentLowRelicColor(): number {
      PodRewardPulseColor.sampleColors();
      return PodRewardPulseColor.sampledLowRelicColor;
    }

    private static sampleColors(): void {
      let game: Game = Game.instance;
      if (game == null || read(game, 'isLeaving', false) || game.time <= 0) {
        PodRewardPulseColor.sampledAt = NaN;
        PodRewardPulseColor.sampledColor = PodRewardPulseColor.MARKER_COLOR;
        PodRewardPulseColor.sampledLowRelicColor = PodRewardPulseColor.LOW_RELIC_MARKER_COLOR;
        return;
      }
      let now: number = game.clock == null ? NaN : game.clock.getServerTime();
      if (now != PodRewardPulseColor.sampledAt) {
        PodRewardPulseColor.sampledAt = now;
        PodRewardPulseColor.sampledColor = PodRewardPulseColor.colorAt(now);
        PodRewardPulseColor.sampledLowRelicColor = PodRewardPulseColor.colorAt(now, true);
      }
    }
  }

  return PodRewardPulseColor;
}
