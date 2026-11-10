// Ported from core/hud/components/SettingsWindowChrome.as; retain original layout and behavior.
import { bound, type Resolve } from '../runtime/As3';
export function createSettingsWindowChrome(resolve: Resolve): any {
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;

  /** ArtifactOverview's flat, double-bordered presentation in a bounded window. */

  class SettingsWindowChrome extends Sprite {
    private static BACKGROUND_COLOR: number = 0x000000;
    private static PANEL_COLOR: number = 0x080808;
    private static OUTER_BORDER_COLOR: number = 0x707070;
    private static INNER_BORDER_COLOR: number = 0x282828;
    private static PANEL_BORDER_COLOR: number = 0x505050;

    constructor(windowWidth: number = 930, windowHeight: number = 580, sidebarWidth: number = 170) {
      super();
      // This one surface catches empty-space clicks; decoration never steals
      // pointer events from the controls layered above the chrome.
      var background: Quad = this.rect(
        0,
        0,
        windowWidth,
        windowHeight,
        SettingsWindowChrome.BACKGROUND_COLOR,
        0.74,
      );
      background.touchable = true;
      this.border(
        1,
        1,
        windowWidth - 2,
        windowHeight - 2,
        SettingsWindowChrome.OUTER_BORDER_COLOR,
        2,
        0.95,
      );
      this.border(
        5,
        5,
        windowWidth - 10,
        windowHeight - 10,
        SettingsWindowChrome.INNER_BORDER_COLOR,
        1,
        0.8,
      );
      this.rect(14, 46, windowWidth - 28, 1, SettingsWindowChrome.PANEL_BORDER_COLOR, 0.8);
      this.section(14, 54, sidebarWidth - 22, windowHeight - 68);
      this.section(sidebarWidth + 8, 54, windowWidth - sidebarWidth - 22, windowHeight - 68);
    }

    @bound
    private section(
      xPosition: number,
      yPosition: number,
      panelWidth: number,
      panelHeight: number,
    ): void {
      this.rect(
        xPosition,
        yPosition,
        panelWidth,
        panelHeight,
        SettingsWindowChrome.PANEL_COLOR,
        0.76,
      );
      this.border(
        xPosition,
        yPosition,
        panelWidth,
        panelHeight,
        SettingsWindowChrome.PANEL_BORDER_COLOR,
        1,
        0.8,
      );
    }

    @bound
    private border(
      xPosition: number,
      yPosition: number,
      borderWidth: number,
      borderHeight: number,
      color: number,
      thickness: number,
      borderAlpha: number,
    ): void {
      this.rect(xPosition, yPosition, borderWidth, thickness, color, borderAlpha);
      this.rect(
        xPosition,
        yPosition + borderHeight - thickness,
        borderWidth,
        thickness,
        color,
        borderAlpha,
      );
      this.rect(xPosition, yPosition, thickness, borderHeight, color, borderAlpha);
      this.rect(
        xPosition + borderWidth - thickness,
        yPosition,
        thickness,
        borderHeight,
        color,
        borderAlpha,
      );
    }

    @bound
    private rect(
      xPosition: number,
      yPosition: number,
      rectWidth: number,
      rectHeight: number,
      color: number,
      opacity: number,
    ): Quad {
      var quad: Quad;
      quad = new Quad(rectWidth, rectHeight, color);
      quad.x = xPosition;
      quad.y = yPosition;
      quad.alpha = opacity;
      quad.touchable = false;
      this.addChild(quad);
      return quad;
    }
  }

  return SettingsWindowChrome;
}
