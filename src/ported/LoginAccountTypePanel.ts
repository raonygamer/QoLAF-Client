// Ported from core/hud/components/LoginAccountTypePanel.as.
import { Sprite, Quad, StarlingTextField as TextField, TextFormat } from '../game/Bindings';
import type { Game } from '../game/Game';
import type { Provider } from '../login/LoginProfile';
import type { createLoginButton } from './LoginButton';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';
import { bound, type Resolve } from '../runtime/HaxeInterop';

export function createLoginAccountTypePanel(resolve: Resolve) {
  const LoginButton = resolve('core.hud.components.LoginButton') as ReturnType<
    typeof createLoginButton
  >;
  resolve('starling.display.Sprite');
  /** Account-provider chooser shown before the add-credentials form. */

  class LoginAccountTypePanel extends Sprite {
    public static PANEL_WIDTH: number = 460;
    public static PANEL_HEIGHT: number = 300;

    private static CONTENT_PADDING: number = 20;
    private static OPTION_HEIGHT: number = 42;
    private static OPTION_GAP: number = 6;

    private onProviderSelected: ((provider: Provider) => void) | null;
    private onCreateSimple: (() => void) | null;
    private onBack: (() => void) | null;
    private optionRows: Sprite[] = [];

    constructor(
      onProviderSelected: ((provider: Provider) => void) | null,
      onCreateSimple: (() => void) | null,
      onBack: (() => void) | null,
    ) {
      super();
      this.onProviderSelected = onProviderSelected;
      this.onCreateSimple = onCreateSimple;
      this.onBack = onBack;
      this.build();
    }

    @bound
    private build(): void {
      const background: Quad = new Quad(
        LoginAccountTypePanel.PANEL_WIDTH,
        LoginAccountTypePanel.PANEL_HEIGHT,
        0x000000,
      );
      background.set_alpha(0.78);
      this.addChild(background);

      const titleFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(15),
        15,
        0xffffff,
      );
      titleFormat.set_horizontalAlign('left');
      const title: TextField = new TextField(
        LoginAccountTypePanel.PANEL_WIDTH - LoginAccountTypePanel.CONTENT_PADDING * 2,
        28,
        'ADD ACCOUNT',
        titleFormat,
      );
      title.set_pixelSnapping(false);
      title.set_x(LoginAccountTypePanel.CONTENT_PADDING);
      title.set_y(9);
      title.set_touchable(false);
      this.addChild(title);

      let y: number = 43;
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

      const backButton = new LoginButton('back', this.handleBack, 0xffffff, 0x222222);
      backButton.set_x(LoginAccountTypePanel.PANEL_WIDTH / 2 - backButton.get_width() / 2);
      backButton.set_y(LoginAccountTypePanel.PANEL_HEIGHT - backButton.get_height() - 8);
      this.addChild(backButton);
    }

    @bound
    private addOption(
      provider: Provider | 'create',
      label: string,
      description: string,
      y: number,
      createAccount: boolean = false,
    ): void {
      const row: Sprite = new Sprite();
      row.set_name(provider);
      row.set_x(LoginAccountTypePanel.CONTENT_PADDING);
      row.set_y(y);

      const background: Quad = new Quad(
        LoginAccountTypePanel.PANEL_WIDTH - LoginAccountTypePanel.CONTENT_PADDING * 2,
        LoginAccountTypePanel.OPTION_HEIGHT,
        createAccount ? 0x163b2d : 0x101820,
      );
      background.set_alpha(0.9);
      row.addChild(background);

      const titleFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(12),
        12,
        createAccount ? 0x66e6a1 : 0xffffff,
      );
      titleFormat.set_horizontalAlign('left');
      const title: TextField = new TextField(
        205,
        LoginAccountTypePanel.OPTION_HEIGHT,
        label,
        titleFormat,
      );
      title.set_pixelSnapping(false);
      title.set_x(12);
      title.set_touchable(false);
      row.addChild(title);

      const detailFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(9),
        9,
        0xaab6c2,
      );
      detailFormat.set_horizontalAlign('left');
      const detail: TextField = new TextField(
        185,
        LoginAccountTypePanel.OPTION_HEIGHT,
        description,
        detailFormat,
      );
      detail.set_pixelSnapping(false);
      detail.set_x(220);
      detail.set_touchable(false);
      row.addChild(detail);

      row.set_useHandCursor(true);
      row.addEventListener('touch', this.onOptionTouch);
      this.optionRows.push(row);
      this.addChild(row);
    }

    @bound
    private onOptionTouch(event: Game.starling.events.TouchEvent): void {
      const row = this.optionRows.find((candidate) => candidate === event.currentTarget);
      if (!row || !event.getTouch(row, 'ended')) return;
      const provider = row.get_name();
      if (provider === 'create') this.onCreateSimple?.();
      else if (provider === 'simple' || provider === 'kongregate' || provider === 'armor')
        this.onProviderSelected?.(provider);
    }

    @bound
    private handleBack(): void {
      this.invoke(this.onBack);
    }

    @bound
    private invoke(callback: (() => void) | null): void {
      if (callback != null) {
        callback();
      }
    }

    @bound
    override dispose(): void {
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
