// Ported from core/hud/components/LoginAccountTypePanel.as; retain original layout and behavior.
import { bound, type Resolve } from '../Runtime/As3';
export function createLoginAccountTypePanel(resolve: Resolve): any {
  const LoginButton: any = resolve('core.hud.components.LoginButton');
  type LoginButton = any;
  const RussoBitmapFontRegistry: any = resolve('core.text.RussoBitmapFontRegistry');
  type RussoBitmapFontRegistry = any;
  const VerdanaBitmapFontRegistry: any = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const TextField: any = resolve('starling.text.TextField');
  type TextField = any;
  const TextFormat: any = resolve('starling.text.TextFormat');
  type TextFormat = any;
  const Align: any = resolve('starling.utils.Align');
  type Align = any;

  /** Account-provider chooser shown before the add-credentials form. */

  class LoginAccountTypePanel extends Sprite {
    public static PANEL_WIDTH: number = 460;
    public static PANEL_HEIGHT: number = 300;

    private static CONTENT_PADDING: number = 20;
    private static OPTION_HEIGHT: number = 42;
    private static OPTION_GAP: number = 6;

    private onProviderSelected!: Function | null;
    private onCreateSimple!: Function | null;
    private onBack!: Function | null;
    private optionRows: Sprite[] = [];

    constructor(param1: Function | null, param2: Function | null, param3: Function | null) {
      super();
      this.onProviderSelected = param1;
      this.onCreateSimple = param2;
      this.onBack = param3;
      this.build();
    }

    @bound
    private build(): void {
      var background: Quad = new Quad(
        LoginAccountTypePanel.PANEL_WIDTH,
        LoginAccountTypePanel.PANEL_HEIGHT,
        0x000000,
      );
      background.alpha = 0.78;
      this.addChild(background);

      var titleFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(15),
        15,
        0xffffff,
      );
      titleFormat.horizontalAlign = Align.LEFT;
      var title: TextField = new TextField(
        LoginAccountTypePanel.PANEL_WIDTH - LoginAccountTypePanel.CONTENT_PADDING * 2,
        28,
        'ADD ACCOUNT',
        titleFormat,
      );
      title.pixelSnapping = false;
      title.x = LoginAccountTypePanel.CONTENT_PADDING;
      title.y = 9;
      title.touchable = false;
      this.addChild(title);

      var y: number = 43;
      this.addOption('simple', 'Simple account', 'E-mail and password', y);
      y += LoginAccountTypePanel.OPTION_HEIGHT + LoginAccountTypePanel.OPTION_GAP;
      this.addOption('kongregate', 'Kongregate account', 'User ID and auth token', y);
      y += LoginAccountTypePanel.OPTION_HEIGHT + LoginAccountTypePanel.OPTION_GAP;
      this.addOption('armor', 'Armor account', 'User ID and auth token', y);
      y += LoginAccountTypePanel.OPTION_HEIGHT + LoginAccountTypePanel.OPTION_GAP;
      this.addOption(
        'create',
        'Create new simple account',
        'Register a new Astroflux login',
        y,
        true,
      );

      var backButton: LoginButton = new LoginButton('back', this.handleBack, 0xffffff, 0x222222);
      backButton.x = LoginAccountTypePanel.PANEL_WIDTH / 2 - backButton.width / 2;
      backButton.y = LoginAccountTypePanel.PANEL_HEIGHT - backButton.height - 8;
      this.addChild(backButton);
    }

    @bound
    private addOption(
      param1: string,
      param2: string,
      param3: string,
      param4: number,
      param5: boolean = false,
    ): void {
      var row: Sprite = new Sprite();
      row.name = param1;
      row.x = LoginAccountTypePanel.CONTENT_PADDING;
      row.y = param4;

      var background: Quad = new Quad(
        LoginAccountTypePanel.PANEL_WIDTH - LoginAccountTypePanel.CONTENT_PADDING * 2,
        LoginAccountTypePanel.OPTION_HEIGHT,
        param5 ? 0x163b2d : 0x101820,
      );
      background.alpha = 0.9;
      row.addChild(background);

      var titleFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(12),
        12,
        param5 ? 0x66e6a1 : 0xffffff,
      );
      titleFormat.horizontalAlign = Align.LEFT;
      var title: TextField = new TextField(
        205,
        LoginAccountTypePanel.OPTION_HEIGHT,
        param2,
        titleFormat,
      );
      title.pixelSnapping = false;
      title.x = 12;
      title.touchable = false;
      row.addChild(title);

      var detailFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(9),
        9,
        0xaab6c2,
      );
      detailFormat.horizontalAlign = Align.LEFT;
      var detail: TextField = new TextField(
        185,
        LoginAccountTypePanel.OPTION_HEIGHT,
        param3,
        detailFormat,
      );
      detail.pixelSnapping = false;
      detail.x = 220;
      detail.touchable = false;
      row.addChild(detail);

      row.useHandCursor = true;
      row.addEventListener('touch', this.onOptionTouch);
      this.optionRows.push(row);
      this.addChild(row);
    }

    @bound
    private onOptionTouch(param1: TouchEvent): void {
      var row: Sprite = <Sprite>param1.currentTarget;
      if (row == null || param1.getTouch(row, 'ended') == null) {
        return;
      }
      if (row.name == 'create') {
        this.invoke(this.onCreateSimple);
      } else if (this.onProviderSelected != null) {
        this.onProviderSelected(row.name);
      }
    }

    @bound
    private handleBack(): void {
      this.invoke(this.onBack);
    }

    @bound
    private invoke(param1: Function | null): void {
      if (param1 != null) {
        param1();
      }
    }

    @bound
    /*override*/
    public dispose(): void {
      for (const row of this.optionRows) {
        row.removeEventListener('touch', this.onOptionTouch);
      }
      this.optionRows.length = 0;
      this.onProviderSelected = null;
      this.onCreateSimple = null;
      this.onBack = null;
      super.dispose();
    }
  }

  return LoginAccountTypePanel;
}
