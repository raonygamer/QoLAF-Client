// Ported from core/hud/components/LoginProfilePanel.as.
import {
  Sprite,
  Quad,
  Point,
  Event,
  BlurFilter,
  StarlingTextField as TextField,
  TextFormat,
} from '../game/Bindings';
import type { Game } from '../game/Game';
import type { Profile } from '../login/LoginProfile';
import type { createLoginButton } from './LoginButton';
import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import { VerdanaBitmapFontRegistry } from '../ui/VerdanaBitmapFontRegistry';
import { bound, type Resolve } from '../runtime/HaxeInterop';

export function createLoginProfilePanel(resolve: Resolve) {
  const LoginButton = resolve('core.hud.components.LoginButton') as ReturnType<
    typeof createLoginButton
  >;
  type LoginButton = InstanceType<typeof LoginButton>;
  type TouchEvent = Game.starling.events.TouchEvent;
  // Preserve inherited aliases used by source screens that consume this panel.
  resolve('starling.display.Sprite');
  /**
   * A self-contained profile chooser for the pre-login screen.
   *
   * It deliberately uses only embedded fonts and basic Starling primitives so it
   * can be created before AstroTheme and the runtime texture service are ready.
   * Profile objects are expected to contain:
   *
   *   { id:String, type:String, label:String, detail:String,
   *     accountName:String, removable:Boolean }
   *
   * A profile whose type is "steam" is always placed in the first row of the
   * first page and can never be removed, even if its removable property was
   * accidentally set. Later pages use all four rows for saved accounts.
   */

  class LoginProfilePanel extends Sprite {
    public static PANEL_WIDTH: number = 460;
    public static PANEL_HEIGHT: number = 361;

    private static CONTENT_PADDING: number = 10;
    private static HEADER_HEIGHT: number = 42;
    private static ROW_HEIGHT: number = 40;
    private static ROW_GAP: number = 4;
    private static MAX_VISIBLE_ROWS: number = 4;
    private static ACTION_GAP: number = 8;
    private static ACTION_BUTTON_WIDTH: number = 104;

    private onAddCallback: (() => void) | null;
    private onEditCallback: ((profile: Profile) => void) | null;
    private onRemoveCallback: ((profile: Profile) => void) | null;
    private onLoginCallback: ((profile: Profile) => void) | null;
    private onAutoLoginChangedCallback: ((enabled: boolean) => void) | null;
    private onSteamIntegrationChangedCallback: ((enabled: boolean) => void) | null;

    private background!: Quad;
    private rowsContainer!: Sprite;
    private titleText!: TextField;
    private statusText!: TextField;
    private pageText!: TextField;
    private previousPageButton!: Sprite;
    private nextPageButton!: Sprite;
    private addButton!: LoginButton;
    private editButton!: LoginButton;
    private removeButton!: LoginButton;
    private loginButton!: LoginButton;
    private autoLoginToggle!: Sprite;
    private autoLoginMark!: Quad;
    private autoLoginText!: TextField;
    private steamIntegrationToggle!: Sprite;
    private steamIntegrationMark!: Quad;
    private steamIntegrationText!: TextField;

    private _profiles: Profile[] = [];
    private _selectedProfileId!: string | null;
    private _autoLogin: boolean = false;
    private _steamIntegrationAvailable: boolean = false;
    private _steamIntegrationEnabled: boolean = false;
    private pageIndex: number = 0;
    private pageCount: number = 1;
    private rowEmailLabels = new Map<Sprite, TextField>();
    private rowEmailBlurFilters = new Map<Sprite, BlurFilter>();
    private rowEmailRevealWidths = new Map<Sprite, number>();

    constructor(
      onAdd: (() => void) | null,
      onRemove: ((profile: Profile) => void) | null,
      onLogin: ((profile: Profile) => void) | null,
      onAutoLoginChanged: ((enabled: boolean) => void) | null,
      onSteamIntegrationChanged: ((enabled: boolean) => void) | null = null,
      onEdit: ((profile: Profile) => void) | null = null,
    ) {
      super();
      this.onAddCallback = onAdd;
      this.onRemoveCallback = onRemove;
      this.onLoginCallback = onLogin;
      this.onAutoLoginChangedCallback = onAutoLoginChanged;
      this.onSteamIntegrationChangedCallback = onSteamIntegrationChanged;
      this.onEditCallback = onEdit;
      this.build();
      this.rebuildRows();
    }

    @bound
    private build(): void {
      var titleFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(15),
        15,
        0xffffff,
      );
      titleFormat.set_horizontalAlign('left');

      this.background = new Quad(
        LoginProfilePanel.PANEL_WIDTH,
        LoginProfilePanel.PANEL_HEIGHT,
        0x000000,
      );
      this.background.set_alpha(0.78);
      this.addChild(this.background);

      this.titleText = new TextField(82, 28, 'PROFILES', titleFormat);
      this.titleText.set_pixelSnapping(false);
      this.titleText.set_x(LoginProfilePanel.CONTENT_PADDING);
      this.titleText.set_y(8);
      this.titleText.set_touchable(false);
      this.addChild(this.titleText);

      var statusFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(9),
        9,
        0xff6666,
      );
      statusFormat.set_horizontalAlign('left');
      this.statusText = new TextField(225, 34, '', statusFormat);
      this.statusText.set_pixelSnapping(false);
      this.statusText.set_x(96);
      this.statusText.set_y(4);
      this.statusText.set_wordWrap(true);
      this.statusText.set_touchable(false);
      this.statusText.set_visible(false);
      this.addChild(this.statusText);

      this.pageText = this.createSmallText(56, 24, '');
      this.pageText.set_x(LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING - 116);
      this.pageText.set_y(10);
      this.addChild(this.pageText);

      this.previousPageButton = this.createPageButton('<', this.onPreviousPageTouch);
      this.previousPageButton.set_x(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING - 56,
      );
      this.previousPageButton.set_y(9);
      this.addChild(this.previousPageButton);

      this.nextPageButton = this.createPageButton('>', this.onNextPageTouch);
      this.nextPageButton.set_x(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING - 28,
      );
      this.nextPageButton.set_y(9);
      this.addChild(this.nextPageButton);

      this.rowsContainer = new Sprite();
      this.rowsContainer.set_x(LoginProfilePanel.CONTENT_PADDING);
      this.rowsContainer.set_y(LoginProfilePanel.HEADER_HEIGHT);
      this.addChild(this.rowsContainer);

      var actionsY: number =
        LoginProfilePanel.HEADER_HEIGHT +
        LoginProfilePanel.MAX_VISIBLE_ROWS *
          (LoginProfilePanel.ROW_HEIGHT + LoginProfilePanel.ROW_GAP) +
        10;
      var actionsWidth: number =
        LoginProfilePanel.ACTION_BUTTON_WIDTH * 4 + LoginProfilePanel.ACTION_GAP * 3;
      var actionsX: number = (LoginProfilePanel.PANEL_WIDTH - actionsWidth) / 2;

      this.addButton = new LoginButton(
        '+',
        this.addProfile,
        0xffffff,
        0,
        LoginProfilePanel.ACTION_BUTTON_WIDTH,
      );
      this.addButton.set_x(actionsX);
      this.addButton.set_y(actionsY);
      this.addChild(this.addButton);

      this.editButton = new LoginButton(
        'edit',
        this.editSelected,
        0xffffff,
        0,
        LoginProfilePanel.ACTION_BUTTON_WIDTH,
      );
      this.editButton.set_x(
        this.addButton.get_x() + this.addButton.get_width() + LoginProfilePanel.ACTION_GAP,
      );
      this.editButton.set_y(actionsY);
      this.addChild(this.editButton);

      this.removeButton = new LoginButton(
        'remove',
        this.removeSelected,
        0xffffff,
        0,
        LoginProfilePanel.ACTION_BUTTON_WIDTH,
      );
      this.removeButton.set_x(
        this.editButton.get_x() + this.editButton.get_width() + LoginProfilePanel.ACTION_GAP,
      );
      this.removeButton.set_y(actionsY);
      this.addChild(this.removeButton);

      this.loginButton = new LoginButton(
        'login',
        this.loginSelected,
        0xffffff,
        0,
        LoginProfilePanel.ACTION_BUTTON_WIDTH,
      );
      this.loginButton.set_x(
        this.removeButton.get_x() + this.removeButton.get_width() + LoginProfilePanel.ACTION_GAP,
      );
      this.loginButton.set_y(actionsY);
      this.addChild(this.loginButton);

      this.buildAutoLoginToggle(actionsY + this.loginButton.get_height() + 7);
      this.buildSteamIntegrationToggle(this.autoLoginToggle.get_y() + 34);
    }

    @bound
    private buildAutoLoginToggle(param1: number): void {
      var hitArea: Quad;
      var outline: Quad;
      this.autoLoginToggle = new Sprite();
      this.autoLoginToggle.set_x(LoginProfilePanel.CONTENT_PADDING);
      this.autoLoginToggle.set_y(param1);

      hitArea = new Quad(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING * 2,
        34,
        0x000000,
      );
      hitArea.set_alpha(0.01);
      this.autoLoginToggle.addChild(hitArea);

      outline = new Quad(18, 18, 0xffffff);
      outline.set_x(4);
      outline.set_y(8);
      outline.set_alpha(0.75);
      this.autoLoginToggle.addChild(outline);

      var checkboxBackground: Quad = new Quad(14, 14, 0x111820);
      checkboxBackground.set_x(6);
      checkboxBackground.set_y(10);
      this.autoLoginToggle.addChild(checkboxBackground);

      this.autoLoginMark = new Quad(10, 10, 0x55dd99);
      this.autoLoginMark.set_x(8);
      this.autoLoginMark.set_y(12);
      this.autoLoginToggle.addChild(this.autoLoginMark);

      var toggleFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(10),
        10,
        0xffffff,
      );
      toggleFormat.set_horizontalAlign('left');
      this.autoLoginText = new TextField(
        400,
        30,
        'Login automatically with the last profile next time.',
        toggleFormat,
      );
      this.autoLoginText.set_pixelSnapping(false);
      this.autoLoginText.set_x(30);
      this.autoLoginText.set_y(1);
      this.autoLoginText.set_touchable(false);
      this.autoLoginToggle.addChild(this.autoLoginText);

      this.autoLoginToggle.set_useHandCursor(true);
      this.autoLoginToggle.addEventListener('touch', this.onAutoLoginTouch);
      this.addChild(this.autoLoginToggle);
      this.updateAutoLoginDisplay();
    }

    @bound
    private buildSteamIntegrationToggle(param1: number): void {
      this.steamIntegrationToggle = new Sprite();
      this.steamIntegrationToggle.set_x(LoginProfilePanel.CONTENT_PADDING);
      this.steamIntegrationToggle.set_y(param1);

      var hitArea: Quad = new Quad(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING * 2,
        38,
        0x000000,
      );
      hitArea.set_alpha(0.01);
      this.steamIntegrationToggle.addChild(hitArea);

      var outline: Quad = new Quad(18, 18, 0xffffff);
      outline.set_x(4);
      outline.set_y(9);
      outline.set_alpha(0.75);
      this.steamIntegrationToggle.addChild(outline);

      var checkboxBackground: Quad = new Quad(14, 14, 0x111820);
      checkboxBackground.set_x(6);
      checkboxBackground.set_y(11);
      this.steamIntegrationToggle.addChild(checkboxBackground);

      this.steamIntegrationMark = new Quad(10, 10, 0x55dd99);
      this.steamIntegrationMark.set_x(8);
      this.steamIntegrationMark.set_y(13);
      this.steamIntegrationToggle.addChild(this.steamIntegrationMark);

      var toggleFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(10),
        10,
        0xffffff,
      );
      toggleFormat.set_horizontalAlign('left');
      this.steamIntegrationText = new TextField(400, 32, 'Enable steam integration.', toggleFormat);
      this.steamIntegrationText.set_pixelSnapping(false);
      this.steamIntegrationText.set_x(30);
      this.steamIntegrationText.set_y(3);
      this.steamIntegrationText.set_touchable(false);
      this.steamIntegrationToggle.addChild(this.steamIntegrationText);

      this.steamIntegrationToggle.addEventListener('touch', this.onSteamIntegrationTouch);
      this.addChild(this.steamIntegrationToggle);
      this.updateSteamIntegrationDisplay();
    }

    @bound
    private createSmallText(param1: number, param2: number, param3: string): TextField {
      var format: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(10),
        10,
        0xaab6c2,
      );
      var result: TextField = new TextField(param1, param2, param3, format);
      result.set_pixelSnapping(false);
      result.set_touchable(false);
      return result;
    }

    @bound
    private createPageButton(param1: string, param2: ((event: TouchEvent) => void) | null): Sprite {
      var result: Sprite = new Sprite();
      var pageBackground: Quad = new Quad(24, 24, 0x101820);
      pageBackground.set_alpha(0.9);
      result.addChild(pageBackground);

      var format: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(12),
        12,
        0xffffff,
      );
      var label: TextField = new TextField(24, 22, param1, format);
      label.set_pixelSnapping(false);
      label.set_y(1);
      label.set_touchable(false);
      result.addChild(label);
      result.set_useHandCursor(true);
      result.addEventListener('touch', param2);
      return result;
    }

    /** Replaces the available profiles and selects the requested id when valid. */
    @bound
    public setProfiles(
      param1: readonly (Profile | null)[] | null,
      param2: string | null = null,
    ): void {
      var wantedId: string | null = param2 != null ? param2 : this._selectedProfileId;
      this._profiles = this.normalizeProfiles(param1);

      if (this.findProfile(wantedId) != null) {
        this._selectedProfileId = wantedId;
      } else {
        this._selectedProfileId =
          this._profiles.length > 0 ? this.profileId(this._profiles[0]) : null;
      }

      this.revealSelectedPage();
      this.rebuildRows();
    }

    public get profiles(): Profile[] {
      return this._profiles.concat();
    }

    public set profiles(param1: Profile[]) {
      this.setProfiles(param1, this._selectedProfileId);
    }

    public get selectedProfile(): Profile | null {
      return this.findProfile(this._selectedProfileId);
    }

    public get selectedProfileId(): string | null {
      return this._selectedProfileId;
    }

    public set selectedProfileId(param1: string) {
      this.selectProfile(param1, false);
    }

    public get autoLogin(): boolean {
      return this._autoLogin;
    }

    public set autoLogin(param1: boolean) {
      this._autoLogin = param1;
      this.updateAutoLoginDisplay();
    }

    public get steamIntegrationAvailable(): boolean {
      return this._steamIntegrationAvailable;
    }

    public set steamIntegrationAvailable(param1: boolean) {
      this._steamIntegrationAvailable = param1;
      if (!param1) {
        this._steamIntegrationEnabled = false;
      }
      this.updateSteamIntegrationDisplay();
    }

    public get steamIntegrationEnabled(): boolean {
      return this._steamIntegrationEnabled;
    }

    public set steamIntegrationEnabled(param1: boolean) {
      this._steamIntegrationEnabled = this._steamIntegrationAvailable && param1;
      this.updateSteamIntegrationDisplay();
    }

    public get statusMessage(): string {
      return this.statusText == null ? '' : this.statusText.get_text();
    }

    public set statusMessage(param1: string) {
      if (this.statusText == null) {
        return;
      }
      this.statusText.set_text(param1 == null ? '' : param1);
      this.statusText.set_visible(this.statusText.get_text().length > 0);
    }

    /** Invokes the login callback for the current selection. */
    @bound
    public loginSelected(): void {
      const profile = this.selectedProfile;
      if (profile == null || !this.profileEnabled(profile)) {
        return;
      }
      this.invokeCallback(this.onLoginCallback, profile);
    }

    @bound
    private addProfile(): void {
      this.invokeCallback(this.onAddCallback);
    }

    @bound
    private editSelected(): void {
      const profile = this.selectedProfile;
      if (profile == null || this.profileType(profile) != 'site' || !this.profileEnabled(profile)) {
        return;
      }
      this.invokeCallback(this.onEditCallback, profile);
    }

    @bound
    private removeSelected(): void {
      const profile = this.selectedProfile;
      if (profile == null || !this.profileRemovable(profile)) {
        return;
      }
      this.invokeCallback(this.onRemoveCallback, profile);
    }

    @bound
    private onAutoLoginTouch(param1: TouchEvent): void {
      if (param1.getTouch(this.autoLoginToggle, 'ended') == null) {
        return;
      }
      this._autoLogin = !this._autoLogin;
      this.updateAutoLoginDisplay();
      this.invokeCallback(this.onAutoLoginChangedCallback, this._autoLogin);
    }

    @bound
    private updateAutoLoginDisplay(): void {
      if (this.autoLoginMark == null || this.autoLoginText == null) {
        return;
      }
      this.autoLoginMark.set_visible(this._autoLogin);
      this.autoLoginText.get_format().set_color(this._autoLogin ? 0x55dd99 : 0xffffff);
    }

    @bound
    private onSteamIntegrationTouch(param1: TouchEvent): void {
      if (
        !this._steamIntegrationAvailable ||
        param1.getTouch(this.steamIntegrationToggle, 'ended') == null
      ) {
        return;
      }
      this._steamIntegrationEnabled = !this._steamIntegrationEnabled;
      this.updateSteamIntegrationDisplay();
      this.invokeCallback(this.onSteamIntegrationChangedCallback, this._steamIntegrationEnabled);
    }

    @bound
    private updateSteamIntegrationDisplay(): void {
      if (
        this.steamIntegrationToggle == null ||
        this.steamIntegrationMark == null ||
        this.steamIntegrationText == null
      ) {
        return;
      }
      this.steamIntegrationToggle.set_touchable(this._steamIntegrationAvailable);
      this.steamIntegrationToggle.set_useHandCursor(this._steamIntegrationAvailable);
      this.steamIntegrationToggle.set_alpha(this._steamIntegrationAvailable ? 1 : 0.45);
      this.steamIntegrationMark.set_visible(
        this._steamIntegrationAvailable && this._steamIntegrationEnabled,
      );
      this.steamIntegrationText
        .get_format()
        .set_color(
          !this._steamIntegrationAvailable
            ? 0x777777
            : this._steamIntegrationEnabled
              ? 0x55dd99
              : 0xffffff,
        );
    }

    @bound
    private normalizeProfiles(param1: readonly (Profile | null)[] | null): Profile[] {
      const result: Profile[] = [];
      let steamProfile: Profile | null = null;
      let profile: Profile | null;
      if (param1 == null) {
        return result;
      }
      for (profile of param1) {
        if (profile == null || this.profileId(profile) == '') {
          continue;
        }
        if (steamProfile == null && this.profileType(profile) == 'steam') {
          steamProfile = profile;
        } else {
          result.push(profile);
        }
      }
      if (steamProfile != null) {
        result.unshift(steamProfile);
      }
      return result;
    }

    @bound
    private rebuildRows(): void {
      const pinnedProfile = this.pinnedSteamProfile();
      var localStart: number = pinnedProfile != null ? 1 : 0;
      var localCount: number = Math.max(0, this._profiles.length - localStart);
      if (pinnedProfile != null) {
        var firstPageCapacity: number = LoginProfilePanel.MAX_VISIBLE_ROWS - 1;
        this.pageCount =
          localCount <= firstPageCapacity
            ? 1
            : 1 +
              Number(
                Math.ceil((localCount - firstPageCapacity) / LoginProfilePanel.MAX_VISIBLE_ROWS),
              );
      } else {
        this.pageCount = Math.max(
          1,
          Number(Math.ceil(localCount / LoginProfilePanel.MAX_VISIBLE_ROWS)),
        );
      }
      this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pageCount - 1));

      this.clearRows();
      var rowY: number = 0;
      if (pinnedProfile != null && this.pageIndex == 0) {
        this.addRow(pinnedProfile, rowY, true);
        rowY += LoginProfilePanel.ROW_HEIGHT + LoginProfilePanel.ROW_GAP;
      }

      var start: number;
      var pageSize: number;
      if (pinnedProfile != null) {
        if (this.pageIndex == 0) {
          start = localStart;
          pageSize = LoginProfilePanel.MAX_VISIBLE_ROWS - 1;
        } else {
          start =
            localStart +
            (LoginProfilePanel.MAX_VISIBLE_ROWS - 1) +
            (this.pageIndex - 1) * LoginProfilePanel.MAX_VISIBLE_ROWS;
          pageSize = LoginProfilePanel.MAX_VISIBLE_ROWS;
        }
      } else {
        start = this.pageIndex * LoginProfilePanel.MAX_VISIBLE_ROWS;
        pageSize = LoginProfilePanel.MAX_VISIBLE_ROWS;
      }
      var end: number = Math.min(this._profiles.length, start + pageSize);
      var i: number;
      for (i = start; i < end; i++) {
        this.addRow(this._profiles[i], rowY, false);
        rowY += LoginProfilePanel.ROW_HEIGHT + LoginProfilePanel.ROW_GAP;
      }

      this.pageText.set_visible(this.pageCount > 1);
      this.previousPageButton.set_visible(this.pageCount > 1);
      this.nextPageButton.set_visible(this.pageCount > 1);
      this.pageText.set_text(this.pageCount > 1 ? this.pageIndex + 1 + '/' + this.pageCount : '');
      this.setPageButtonEnabled(this.previousPageButton, this.pageIndex > 0);
      this.setPageButtonEnabled(this.nextPageButton, this.pageIndex < this.pageCount - 1);
      this.updateActions();
    }

    @bound
    private addRow(param1: Profile | null, param2: number, param3: boolean): void {
      var row: Sprite = this.createRow(
        param1,
        this.profileId(param1) == this._selectedProfileId,
        param3,
        this.profileEnabled(param1),
      );
      row.set_y(param2);
      this.rowsContainer.addChild(row);
    }

    @bound
    private createRow(
      param1: Profile | null,
      param2: boolean,
      param3: boolean,
      param4: boolean,
    ): Sprite {
      var row: Sprite = new Sprite();
      row.set_name(this.profileId(param1));

      var rowBackground: Quad = new Quad(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING * 2,
        LoginProfilePanel.ROW_HEIGHT,
        param2 ? 0x29465a : 0x101820,
      );
      rowBackground.set_alpha(param2 ? 0.95 : 0.78);
      row.addChild(rowBackground);

      var selectionBar: Quad = new Quad(
        4,
        LoginProfilePanel.ROW_HEIGHT,
        param2 ? 0x55dd99 : 0x354553,
      );
      selectionBar.set_alpha(param2 ? 1 : 0.65);
      row.addChild(selectionBar);

      var labelFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(12),
        12,
        param4 ? 0xffffff : 0x777777,
      );
      labelFormat.set_horizontalAlign('left');
      if (this.profileType(param1) == 'site') {
        this.addPrivateIdentifierLabel(
          row,
          this.profileString(param1, 'label', ''),
          315,
          labelFormat,
        );
      } else {
        var label: TextField = new TextField(
          315,
          param3 ? 14 : 21,
          this.profileString(param1, 'label', this.profileString(param1, 'id', 'Profile')),
          labelFormat,
        );
        label.set_pixelSnapping(false);
        label.set_x(12);
        label.set_y(param3 ? 0 : 1);
        label.set_touchable(false);
        row.addChild(label);
      }

      var detailFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(10),
        10,
        param4 ? 0xaab6c2 : 0x666666,
      );
      detailFormat.set_horizontalAlign('left');
      var accountName: string = this.profileString(param1, 'accountName', '');
      var detail: TextField = new TextField(
        315,
        param3 ? 14 : 17,
        accountName == '' ? 'Uncached player name' : accountName,
        detailFormat,
      );
      detail.set_pixelSnapping(false);
      detail.set_x(12);
      detail.set_y(param3 ? 13 : 21);
      detail.set_touchable(false);
      row.addChild(detail);

      if (param3) {
        var sessionFormat: TextFormat = new TextFormat(
          VerdanaBitmapFontRegistry.fontNameForSize(8),
          8,
          param4 ? 0x7f929f : 0x555555,
        );
        sessionFormat.set_horizontalAlign('left');
        var session: TextField = new TextField(
          315,
          13,
          this.profileString(param1, 'detail', 'Steam profile (current session)'),
          sessionFormat,
        );
        session.set_pixelSnapping(false);
        session.set_x(12);
        session.set_y(26);
        session.set_touchable(false);
        row.addChild(session);
      }

      var badgeFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(9),
        9,
        param4 ? 0x55dd99 : 0x777777,
      );
      var badge: TextField = new TextField(100, 22, this.profileProviderBadge(param1), badgeFormat);
      badge.set_pixelSnapping(false);
      badge.set_x(rowBackground.get_width() - badge.get_width() - 8);
      badge.set_y(9);
      badge.set_touchable(false);
      row.addChild(badge);

      row.set_alpha(param4 ? 1 : 0.55);
      row.set_touchable(param4);
      row.set_useHandCursor(param4);
      if (param4) {
        row.addEventListener('touch', this.onRowTouch);
      }
      return row;
    }

    @bound
    private addPrivateIdentifierLabel(
      param1: Sprite,
      param2: string,
      param3: number,
      param4: TextFormat,
    ): void {
      var atIndex: number = param2.lastIndexOf('@');
      var privateText: string = atIndex > 0 ? param2.substring(0, atIndex) : param2;
      var publicText: string = atIndex > 0 ? param2.substring(atIndex) : '';

      var privateLabel: TextField = new TextField(param3, 21, privateText, param4);
      privateLabel.set_pixelSnapping(false);
      privateLabel.set_wordWrap(false);
      privateLabel.set_x(12);
      privateLabel.set_y(1);
      privateLabel.set_touchable(false);

      var publicWidth: number = 0;
      let publicLabel: TextField | null = null;
      if (publicText != '') {
        publicLabel = new TextField(param3, 21, publicText, param4);
        publicLabel.set_pixelSnapping(false);
        publicLabel.set_wordWrap(false);
        publicWidth = Math.min(param3 - 1, Math.ceil(publicLabel.get_textBounds().width) + 2);
      }

      var privateWidth: number = Math.ceil(privateLabel.get_textBounds().width) + 2;
      privateWidth = Math.max(1, Math.min(privateWidth, param3 - publicWidth));
      privateLabel.set_width(privateWidth);
      param1.addChild(privateLabel);

      if (publicLabel != null) {
        // Bitmap glyphs have no generated TrueType texture gutter. Remove
        // only our two-pixel measurement padding so @domain starts at the
        // real end of the blurred private prefix.
        var joinOffset: number = Math.max(1, privateWidth - 2);
        publicLabel.set_width(Math.max(1, Math.min(publicWidth, param3 - joinOffset)));
        publicLabel.set_x(privateLabel.get_x() + joinOffset);
        publicLabel.set_y(privateLabel.get_y());
        publicLabel.set_touchable(false);
        param1.addChild(publicLabel);
        this.rowEmailRevealWidths.set(param1, joinOffset);
      } else {
        this.rowEmailRevealWidths.set(param1, privateWidth);
      }

      var spoilerBlur: BlurFilter = new BlurFilter(4, 2, 0.5);
      privateLabel.set_filter(spoilerBlur);
      spoilerBlur.cache();
      this.rowEmailLabels.set(param1, privateLabel);
      this.rowEmailBlurFilters.set(param1, spoilerBlur);
    }

    @bound
    private onRowTouch(param1: TouchEvent): void {
      const row = param1.currentTarget;
      if (!(row instanceof Sprite)) return;
      if (row == null) {
        return;
      }
      const touch = param1.getTouch(row);
      if (touch == null) {
        // Starling also dispatches a hover-target change through the old
        // bubble chain. In that event the touch no longer belongs to this
        // row, which is our reliable mouse-out notification.
        this.setRowEmailRevealed(row, false);
        return;
      }
      const emailLabel = this.rowEmailLabels.get(row);
      var revealWidth: number =
        this.rowEmailRevealWidths.get(row) == null
          ? emailLabel == null
            ? 0
            : emailLabel.get_width()
          : Number(this.rowEmailRevealWidths.get(row));
      var position: Point = touch.getLocation(row);
      var isOverPrivateEmail: boolean =
        emailLabel != null &&
        position.x >= emailLabel.get_x() &&
        position.x <= emailLabel.get_x() + revealWidth &&
        position.y >= emailLabel.get_y() &&
        position.y <= emailLabel.get_y() + emailLabel.get_height();
      this.setRowEmailRevealed(row, isOverPrivateEmail);

      if (touch.get_phase() == 'ended') {
        if (touch.get_cancelled()) {
          return;
        }
        this.selectProfile(row.get_name(), false);
        this.dispatchEventWith(Event.CHANGE, false, this.selectedProfile);
      }
    }

    @bound
    private setRowEmailRevealed(param1: Sprite, param2: boolean): void {
      const label = this.rowEmailLabels.get(param1);
      const spoilerBlur = this.rowEmailBlurFilters.get(param1);
      if (label != null && spoilerBlur != null) {
        if (param2) {
          if (label.get_filter() != null) {
            label.set_filter(null);
          }
        } else if (label.get_filter() !== spoilerBlur) {
          label.set_filter(spoilerBlur);
          // Detaching a cached Starling filter disposes its cached target
          // texture. Request a fresh cache whenever the spoiler is restored.
          spoilerBlur.cache();
        }
      }
    }

    @bound
    private clearRows(): void {
      while (this.rowsContainer.get_numChildren() > 0) {
        const row = this.rowsContainer.getChildAt(0);
        if (row instanceof Sprite) {
          row.removeEventListener('touch', this.onRowTouch);
          const label = this.rowEmailLabels.get(row);
          const spoilerBlur = this.rowEmailBlurFilters.get(row);
          if (label != null) {
            label.set_filter(null);
          }
          if (spoilerBlur != null) {
            spoilerBlur.dispose();
          }
          this.rowEmailLabels.delete(row);
          this.rowEmailBlurFilters.delete(row);
          this.rowEmailRevealWidths.delete(row);
        }
        this.rowsContainer.removeChildAt(0, true);
      }
    }

    @bound
    private selectProfile(param1: string, param2: boolean): void {
      if (this.findProfile(param1) == null || this._selectedProfileId == param1) {
        return;
      }
      this._selectedProfileId = param1;
      this.revealSelectedPage();
      this.rebuildRows();
      if (param2) {
        this.dispatchEventWith(Event.CHANGE, false, this.selectedProfile);
      }
    }

    @bound
    private revealSelectedPage(): void {
      const pinnedProfile = this.pinnedSteamProfile();
      var localStart: number = pinnedProfile != null ? 1 : 0;
      var i: number;
      for (i = localStart; i < this._profiles.length; i++) {
        if (this.profileId(this._profiles[i]) == this._selectedProfileId) {
          var localIndex: number = i - localStart;
          if (pinnedProfile != null) {
            var firstPageCapacity: number = LoginProfilePanel.MAX_VISIBLE_ROWS - 1;
            this.pageIndex =
              localIndex < firstPageCapacity
                ? 0
                : 1 + Number((localIndex - firstPageCapacity) / LoginProfilePanel.MAX_VISIBLE_ROWS);
          } else {
            this.pageIndex = Number(localIndex / LoginProfilePanel.MAX_VISIBLE_ROWS);
          }
          return;
        }
      }
      if (pinnedProfile != null && this.profileId(pinnedProfile) == this._selectedProfileId) {
        this.pageIndex = 0;
      }
    }

    @bound
    private onPreviousPageTouch(param1: TouchEvent): void {
      if (param1.getTouch(this.previousPageButton, 'ended') == null) {
        return;
      }
      this.dispatchEventWith(Event.CHANGE, false, this.selectedProfile);
      if (this.pageIndex <= 0) {
        return;
      }
      this.pageIndex--;
      this.rebuildRows();
    }

    @bound
    private onNextPageTouch(param1: TouchEvent): void {
      if (param1.getTouch(this.nextPageButton, 'ended') == null) {
        return;
      }
      this.dispatchEventWith(Event.CHANGE, false, this.selectedProfile);
      if (this.pageIndex >= this.pageCount - 1) {
        return;
      }
      this.pageIndex++;
      this.rebuildRows();
    }

    @bound
    private setPageButtonEnabled(param1: Sprite, param2: boolean): void {
      param1.set_touchable(param2);
      param1.set_useHandCursor(param2);
      param1.set_alpha(param2 ? 1 : 0.35);
    }

    @bound
    private updateActions(): void {
      const profile = this.selectedProfile;
      this.editButton.enabled =
        profile != null && this.profileType(profile) == 'site' && this.profileEnabled(profile);
      this.removeButton.enabled = profile != null && this.profileRemovable(profile);
      this.loginButton.enabled = profile != null && this.profileEnabled(profile);
    }

    @bound
    private pinnedSteamProfile(): Profile | null {
      if (this._profiles.length > 0 && this.profileType(this._profiles[0]) == 'steam') {
        return this._profiles[0];
      }
      return null;
    }

    @bound
    private findProfile(param1: string | null): Profile | null {
      let profile: Profile | null;
      if (param1 == null) {
        return null;
      }
      for (profile of this._profiles) {
        if (this.profileId(profile) == param1) {
          return profile;
        }
      }
      return null;
    }

    @bound
    private profileId(param1: Profile | null): string {
      const value = this.profileProperty(param1, 'id', '');
      return value == null ? '' : String(value);
    }

    @bound
    private profileType(param1: Profile | null): string {
      const value = this.profileProperty(param1, 'type', '');
      return value == null ? '' : String(value).toLowerCase();
    }

    @bound
    private profileProviderBadge(param1: Profile | null): string {
      if (this.profileType(param1) == 'steam') {
        return 'STEAM';
      }
      var provider: string = this.profileString(param1, 'authProvider', 'simple').toLowerCase();
      if (provider == 'kongregate') {
        return 'KONGREGATE';
      }
      if (provider == 'armor') {
        return 'ARMOR';
      }
      return 'SIMPLE';
    }

    @bound
    private profileEnabled(param1: Profile | null): boolean {
      return Boolean(this.profileProperty(param1, 'enabled', true));
    }

    @bound
    private profileRemovable(param1: Profile | null): boolean {
      if (this.profileType(param1) == 'steam') {
        return false;
      }
      return Boolean(this.profileProperty(param1, 'removable', true));
    }

    @bound
    private profileProperty<K extends keyof Profile, F>(
      profile: Profile | null,
      key: K,
      fallback: F,
    ): Profile[K] | F {
      return profile && Object.hasOwn(profile, key) ? profile[key] : fallback;
    }

    @bound
    private profileString(profile: Profile | null, key: keyof Profile, fallback: string): string {
      const value = this.profileProperty(profile, key, fallback);
      return value == null ? fallback : String(value);
    }

    @bound
    private invokeCallback<Args extends unknown[]>(
      callback: ((...args: Args) => void) | null,
      ...args: Args
    ): void {
      if (callback) Reflect.apply(callback, undefined, callback.length > 0 ? args : []);
    }

    @bound
    override dispose(): void {
      if (this.autoLoginToggle != null) {
        this.autoLoginToggle.removeEventListener('touch', this.onAutoLoginTouch);
      }
      if (this.steamIntegrationToggle != null) {
        this.steamIntegrationToggle.removeEventListener('touch', this.onSteamIntegrationTouch);
      }
      if (this.previousPageButton != null) {
        this.previousPageButton.removeEventListener('touch', this.onPreviousPageTouch);
      }
      if (this.nextPageButton != null) {
        this.nextPageButton.removeEventListener('touch', this.onNextPageTouch);
      }
      if (this.rowsContainer != null) {
        this.clearRows();
      }
      this.onAddCallback = null;
      this.onEditCallback = null;
      this.onRemoveCallback = null;
      this.onLoginCallback = null;
      this.onAutoLoginChangedCallback = null;
      this.onSteamIntegrationChangedCallback = null;
      this._profiles.length = 0;
      super.dispose();
    }
  }

  return LoginProfilePanel;
}
