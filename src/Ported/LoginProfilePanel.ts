// Ported from core/hud/components/LoginProfilePanel.as; retain original layout and behavior.
import { bound, type Resolve } from '../Runtime/As3';
export function createLoginProfilePanel(resolve: Resolve): any {
  const LoginButton: any = resolve('core.hud.components.LoginButton');
  type LoginButton = any;
  const RussoBitmapFontRegistry: any = resolve('core.text.RussoBitmapFontRegistry');
  type RussoBitmapFontRegistry = any;
  const VerdanaBitmapFontRegistry: any = resolve('core.text.VerdanaBitmapFontRegistry');
  type VerdanaBitmapFontRegistry = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  const Touch: any = resolve('starling.events.Touch');
  type Touch = any;
  const TouchEvent: any = resolve('starling.events.TouchEvent');
  type TouchEvent = any;
  const TouchPhase: any = resolve('starling.events.TouchPhase');
  type TouchPhase = any;
  const BlurFilter: any = resolve('starling.filters.BlurFilter');
  type BlurFilter = any;
  const TextField: any = resolve('starling.text.TextField');
  type TextField = any;
  const TextFormat: any = resolve('starling.text.TextFormat');
  type TextFormat = any;
  const Align: any = resolve('starling.utils.Align');
  type Align = any;

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

    private onAddCallback!: Function | null;
    private onEditCallback!: Function | null;
    private onRemoveCallback!: Function | null;
    private onLoginCallback!: Function | null;
    private onAutoLoginChangedCallback!: Function | null;
    private onSteamIntegrationChangedCallback!: Function | null;

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

    private _profiles: any[] = [];
    private _selectedProfileId!: string | null;
    private _autoLogin: boolean = false;
    private _steamIntegrationAvailable: boolean = false;
    private _steamIntegrationEnabled: boolean = false;
    private pageIndex: number = 0;
    private pageCount: number = 1;
    private rowEmailLabels = new Map<any, any>();
    private rowEmailBlurFilters = new Map<any, any>();
    private rowEmailRevealWidths = new Map<any, any>();

    constructor(
      param1: Function | null,
      param2: Function | null,
      param3: Function | null,
      param4: Function | null,
      param5: Function | null = null,
      param6: Function | null = null,
    ) {
      super();
      this.onAddCallback = param1;
      this.onRemoveCallback = param2;
      this.onLoginCallback = param3;
      this.onAutoLoginChangedCallback = param4;
      this.onSteamIntegrationChangedCallback = param5;
      this.onEditCallback = param6;
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
      titleFormat.horizontalAlign = Align.LEFT;

      this.background = new Quad(
        LoginProfilePanel.PANEL_WIDTH,
        LoginProfilePanel.PANEL_HEIGHT,
        0x000000,
      );
      this.background.alpha = 0.78;
      this.addChild(this.background);

      this.titleText = new TextField(82, 28, 'PROFILES', titleFormat);
      this.titleText.pixelSnapping = false;
      this.titleText.x = LoginProfilePanel.CONTENT_PADDING;
      this.titleText.y = 8;
      this.titleText.touchable = false;
      this.addChild(this.titleText);

      var statusFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(9),
        9,
        0xff6666,
      );
      statusFormat.horizontalAlign = Align.LEFT;
      this.statusText = new TextField(225, 34, '', statusFormat);
      this.statusText.pixelSnapping = false;
      this.statusText.x = 96;
      this.statusText.y = 4;
      this.statusText.wordWrap = true;
      this.statusText.touchable = false;
      this.statusText.visible = false;
      this.addChild(this.statusText);

      this.pageText = this.createSmallText(56, 24, '');
      this.pageText.x = LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING - 116;
      this.pageText.y = 10;
      this.addChild(this.pageText);

      this.previousPageButton = this.createPageButton('<', this.onPreviousPageTouch);
      this.previousPageButton.x =
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING - 56;
      this.previousPageButton.y = 9;
      this.addChild(this.previousPageButton);

      this.nextPageButton = this.createPageButton('>', this.onNextPageTouch);
      this.nextPageButton.x =
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING - 28;
      this.nextPageButton.y = 9;
      this.addChild(this.nextPageButton);

      this.rowsContainer = new Sprite();
      this.rowsContainer.x = LoginProfilePanel.CONTENT_PADDING;
      this.rowsContainer.y = LoginProfilePanel.HEADER_HEIGHT;
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
      this.addButton.x = actionsX;
      this.addButton.y = actionsY;
      this.addChild(this.addButton);

      this.editButton = new LoginButton(
        'edit',
        this.editSelected,
        0xffffff,
        0,
        LoginProfilePanel.ACTION_BUTTON_WIDTH,
      );
      this.editButton.x = this.addButton.x + this.addButton.width + LoginProfilePanel.ACTION_GAP;
      this.editButton.y = actionsY;
      this.addChild(this.editButton);

      this.removeButton = new LoginButton(
        'remove',
        this.removeSelected,
        0xffffff,
        0,
        LoginProfilePanel.ACTION_BUTTON_WIDTH,
      );
      this.removeButton.x =
        this.editButton.x + this.editButton.width + LoginProfilePanel.ACTION_GAP;
      this.removeButton.y = actionsY;
      this.addChild(this.removeButton);

      this.loginButton = new LoginButton(
        'login',
        this.loginSelected,
        0xffffff,
        0,
        LoginProfilePanel.ACTION_BUTTON_WIDTH,
      );
      this.loginButton.x =
        this.removeButton.x + this.removeButton.width + LoginProfilePanel.ACTION_GAP;
      this.loginButton.y = actionsY;
      this.addChild(this.loginButton);

      this.buildAutoLoginToggle(actionsY + this.loginButton.height + 7);
      this.buildSteamIntegrationToggle(this.autoLoginToggle.y + 34);
    }

    @bound
    private buildAutoLoginToggle(param1: number): void {
      var hitArea: Quad;
      var outline: Quad;
      this.autoLoginToggle = new Sprite();
      this.autoLoginToggle.x = LoginProfilePanel.CONTENT_PADDING;
      this.autoLoginToggle.y = param1;

      hitArea = new Quad(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING * 2,
        34,
        0x000000,
      );
      hitArea.alpha = 0.01;
      this.autoLoginToggle.addChild(hitArea);

      outline = new Quad(18, 18, 0xffffff);
      outline.x = 4;
      outline.y = 8;
      outline.alpha = 0.75;
      this.autoLoginToggle.addChild(outline);

      var checkboxBackground: Quad = new Quad(14, 14, 0x111820);
      checkboxBackground.x = 6;
      checkboxBackground.y = 10;
      this.autoLoginToggle.addChild(checkboxBackground);

      this.autoLoginMark = new Quad(10, 10, 0x55dd99);
      this.autoLoginMark.x = 8;
      this.autoLoginMark.y = 12;
      this.autoLoginToggle.addChild(this.autoLoginMark);

      var toggleFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(10),
        10,
        0xffffff,
      );
      toggleFormat.horizontalAlign = Align.LEFT;
      this.autoLoginText = new TextField(
        400,
        30,
        'Login automatically with the last profile next time.',
        toggleFormat,
      );
      this.autoLoginText.pixelSnapping = false;
      this.autoLoginText.x = 30;
      this.autoLoginText.y = 1;
      this.autoLoginText.touchable = false;
      this.autoLoginToggle.addChild(this.autoLoginText);

      this.autoLoginToggle.useHandCursor = true;
      this.autoLoginToggle.addEventListener('touch', this.onAutoLoginTouch);
      this.addChild(this.autoLoginToggle);
      this.updateAutoLoginDisplay();
    }

    @bound
    private buildSteamIntegrationToggle(param1: number): void {
      this.steamIntegrationToggle = new Sprite();
      this.steamIntegrationToggle.x = LoginProfilePanel.CONTENT_PADDING;
      this.steamIntegrationToggle.y = param1;

      var hitArea: Quad = new Quad(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING * 2,
        38,
        0x000000,
      );
      hitArea.alpha = 0.01;
      this.steamIntegrationToggle.addChild(hitArea);

      var outline: Quad = new Quad(18, 18, 0xffffff);
      outline.x = 4;
      outline.y = 9;
      outline.alpha = 0.75;
      this.steamIntegrationToggle.addChild(outline);

      var checkboxBackground: Quad = new Quad(14, 14, 0x111820);
      checkboxBackground.x = 6;
      checkboxBackground.y = 11;
      this.steamIntegrationToggle.addChild(checkboxBackground);

      this.steamIntegrationMark = new Quad(10, 10, 0x55dd99);
      this.steamIntegrationMark.x = 8;
      this.steamIntegrationMark.y = 13;
      this.steamIntegrationToggle.addChild(this.steamIntegrationMark);

      var toggleFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(10),
        10,
        0xffffff,
      );
      toggleFormat.horizontalAlign = Align.LEFT;
      this.steamIntegrationText = new TextField(400, 32, 'Enable steam integration.', toggleFormat);
      this.steamIntegrationText.pixelSnapping = false;
      this.steamIntegrationText.x = 30;
      this.steamIntegrationText.y = 3;
      this.steamIntegrationText.touchable = false;
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
      result.pixelSnapping = false;
      result.touchable = false;
      return result;
    }

    @bound
    private createPageButton(param1: string, param2: Function | null): Sprite {
      var result: Sprite = new Sprite();
      var pageBackground: Quad = new Quad(24, 24, 0x101820);
      pageBackground.alpha = 0.9;
      result.addChild(pageBackground);

      var format: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(12),
        12,
        0xffffff,
      );
      var label: TextField = new TextField(24, 22, param1, format);
      label.pixelSnapping = false;
      label.y = 1;
      label.touchable = false;
      result.addChild(label);
      result.useHandCursor = true;
      result.addEventListener('touch', param2);
      return result;
    }

    /** Replaces the available profiles and selects the requested id when valid. */
    @bound
    public setProfiles(param1: any[], param2: string | null = null): void {
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

    public get profiles(): any[] {
      return this._profiles.concat();
    }

    public set profiles(param1: any[]) {
      this.setProfiles(param1, this._selectedProfileId);
    }

    public get selectedProfile(): any {
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
      return this.statusText == null ? '' : this.statusText.text;
    }

    public set statusMessage(param1: string) {
      if (this.statusText == null) {
        return;
      }
      this.statusText.text = param1 == null ? '' : param1;
      this.statusText.visible = this.statusText.text.length > 0;
    }

    /** Invokes the login callback for the current selection. */
    @bound
    public loginSelected(): void {
      var profile: any = this.selectedProfile;
      if (profile == null || !this.profileEnabled(profile)) {
        return;
      }
      this.invokeCallback(this.onLoginCallback, profile, true);
    }

    @bound
    private addProfile(): void {
      this.invokeCallback(this.onAddCallback);
    }

    @bound
    private editSelected(): void {
      var profile: any = this.selectedProfile;
      if (profile == null || this.profileType(profile) != 'site' || !this.profileEnabled(profile)) {
        return;
      }
      this.invokeCallback(this.onEditCallback, profile, true);
    }

    @bound
    private removeSelected(): void {
      var profile: any = this.selectedProfile;
      if (profile == null || !this.profileRemovable(profile)) {
        return;
      }
      this.invokeCallback(this.onRemoveCallback, profile, true);
    }

    @bound
    private onAutoLoginTouch(param1: TouchEvent): void {
      if (param1.getTouch(this.autoLoginToggle, 'ended') == null) {
        return;
      }
      this._autoLogin = !this._autoLogin;
      this.updateAutoLoginDisplay();
      this.invokeCallback(this.onAutoLoginChangedCallback, this._autoLogin, true);
    }

    @bound
    private updateAutoLoginDisplay(): void {
      if (this.autoLoginMark == null || this.autoLoginText == null) {
        return;
      }
      this.autoLoginMark.visible = this._autoLogin;
      this.autoLoginText.format.color = this._autoLogin ? 0x55dd99 : 0xffffff;
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
      this.invokeCallback(
        this.onSteamIntegrationChangedCallback,
        this._steamIntegrationEnabled,
        true,
      );
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
      this.steamIntegrationToggle.touchable = this._steamIntegrationAvailable;
      this.steamIntegrationToggle.useHandCursor = this._steamIntegrationAvailable;
      this.steamIntegrationToggle.alpha = this._steamIntegrationAvailable ? 1 : 0.45;
      this.steamIntegrationMark.visible =
        this._steamIntegrationAvailable && this._steamIntegrationEnabled;
      this.steamIntegrationText.format.color = !this._steamIntegrationAvailable
        ? 0x777777
        : this._steamIntegrationEnabled
          ? 0x55dd99
          : 0xffffff;
    }

    @bound
    private normalizeProfiles(param1: any[]): any[] {
      var result: any[] = [];
      var steamProfile: any;
      var profile: any;
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
      var pinnedProfile: any = this.pinnedSteamProfile();
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

      this.pageText.visible = this.pageCount > 1;
      this.previousPageButton.visible = this.pageCount > 1;
      this.nextPageButton.visible = this.pageCount > 1;
      this.pageText.text = this.pageCount > 1 ? this.pageIndex + 1 + '/' + this.pageCount : '';
      this.setPageButtonEnabled(this.previousPageButton, this.pageIndex > 0);
      this.setPageButtonEnabled(this.nextPageButton, this.pageIndex < this.pageCount - 1);
      this.updateActions();
    }

    @bound
    private addRow(param1: any, param2: number, param3: boolean): void {
      var row: Sprite = this.createRow(
        param1,
        this.profileId(param1) == this._selectedProfileId,
        param3,
        this.profileEnabled(param1),
      );
      row.y = param2;
      this.rowsContainer.addChild(row);
    }

    @bound
    private createRow(param1: any, param2: boolean, param3: boolean, param4: boolean): Sprite {
      var row: Sprite = new Sprite();
      row.name = this.profileId(param1);

      var rowBackground: Quad = new Quad(
        LoginProfilePanel.PANEL_WIDTH - LoginProfilePanel.CONTENT_PADDING * 2,
        LoginProfilePanel.ROW_HEIGHT,
        param2 ? 0x29465a : 0x101820,
      );
      rowBackground.alpha = param2 ? 0.95 : 0.78;
      row.addChild(rowBackground);

      var selectionBar: Quad = new Quad(
        4,
        LoginProfilePanel.ROW_HEIGHT,
        param2 ? 0x55dd99 : 0x354553,
      );
      selectionBar.alpha = param2 ? 1 : 0.65;
      row.addChild(selectionBar);

      var labelFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(12),
        12,
        param4 ? 0xffffff : 0x777777,
      );
      labelFormat.horizontalAlign = Align.LEFT;
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
        label.pixelSnapping = false;
        label.x = 12;
        label.y = param3 ? 0 : 1;
        label.touchable = false;
        row.addChild(label);
      }

      var detailFormat: TextFormat = new TextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(10),
        10,
        param4 ? 0xaab6c2 : 0x666666,
      );
      detailFormat.horizontalAlign = Align.LEFT;
      var accountName: string = this.profileString(param1, 'accountName', '');
      var detail: TextField = new TextField(
        315,
        param3 ? 14 : 17,
        accountName == '' ? 'Uncached player name' : accountName,
        detailFormat,
      );
      detail.pixelSnapping = false;
      detail.x = 12;
      detail.y = param3 ? 13 : 21;
      detail.touchable = false;
      row.addChild(detail);

      if (param3) {
        var sessionFormat: TextFormat = new TextFormat(
          VerdanaBitmapFontRegistry.fontNameForSize(8),
          8,
          param4 ? 0x7f929f : 0x555555,
        );
        sessionFormat.horizontalAlign = Align.LEFT;
        var session: TextField = new TextField(
          315,
          13,
          this.profileString(param1, 'detail', 'Steam profile (current session)'),
          sessionFormat,
        );
        session.pixelSnapping = false;
        session.x = 12;
        session.y = 26;
        session.touchable = false;
        row.addChild(session);
      }

      var badgeFormat: TextFormat = new TextFormat(
        RussoBitmapFontRegistry.fontNameForSize(9),
        9,
        param4 ? 0x55dd99 : 0x777777,
      );
      var badge: TextField = new TextField(100, 22, this.profileProviderBadge(param1), badgeFormat);
      badge.pixelSnapping = false;
      badge.x = rowBackground.width - badge.width - 8;
      badge.y = 9;
      badge.touchable = false;
      row.addChild(badge);

      row.alpha = param4 ? 1 : 0.55;
      row.touchable = param4;
      row.useHandCursor = param4;
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
      privateLabel.pixelSnapping = false;
      privateLabel.wordWrap = false;
      privateLabel.x = 12;
      privateLabel.y = 1;
      privateLabel.touchable = false;

      var publicWidth: number = 0;
      var publicLabel: TextField;
      if (publicText != '') {
        publicLabel = new TextField(param3, 21, publicText, param4);
        publicLabel.pixelSnapping = false;
        publicLabel.wordWrap = false;
        publicWidth = Math.min(param3 - 1, Math.ceil(publicLabel.textBounds.width) + 2);
      }

      var privateWidth: number = Math.ceil(privateLabel.textBounds.width) + 2;
      privateWidth = Math.max(1, Math.min(privateWidth, param3 - publicWidth));
      privateLabel.width = privateWidth;
      param1.addChild(privateLabel);

      if (publicLabel != null) {
        // Bitmap glyphs have no generated TrueType texture gutter. Remove
        // only our two-pixel measurement padding so @domain starts at the
        // real end of the blurred private prefix.
        var joinOffset: number = Math.max(1, privateWidth - 2);
        publicLabel.width = Math.max(1, Math.min(publicWidth, param3 - joinOffset));
        publicLabel.x = privateLabel.x + joinOffset;
        publicLabel.y = privateLabel.y;
        publicLabel.touchable = false;
        param1.addChild(publicLabel);
        this.rowEmailRevealWidths.set(param1, joinOffset);
      } else {
        this.rowEmailRevealWidths.set(param1, privateWidth);
      }

      var spoilerBlur: BlurFilter = new BlurFilter(4, 2, 0.5);
      privateLabel.filter = spoilerBlur;
      spoilerBlur.cache();
      this.rowEmailLabels.set(param1, privateLabel);
      this.rowEmailBlurFilters.set(param1, spoilerBlur);
    }

    @bound
    private onRowTouch(param1: TouchEvent): void {
      var row: Sprite = <Sprite>param1.currentTarget;
      if (row == null) {
        return;
      }
      var touch: Touch = param1.getTouch(row);
      if (touch == null) {
        // Starling also dispatches a hover-target change through the old
        // bubble chain. In that event the touch no longer belongs to this
        // row, which is our reliable mouse-out notification.
        this.setRowEmailRevealed(row, false);
        return;
      }
      var emailLabel: TextField = <TextField>this.rowEmailLabels.get(row);
      var revealWidth: number =
        this.rowEmailRevealWidths.get(row) == null
          ? emailLabel == null
            ? 0
            : emailLabel.width
          : Number(this.rowEmailRevealWidths.get(row));
      var position: Point = touch.getLocation(row);
      var isOverPrivateEmail: boolean =
        emailLabel != null &&
        position.x >= emailLabel.x &&
        position.x <= emailLabel.x + revealWidth &&
        position.y >= emailLabel.y &&
        position.y <= emailLabel.y + emailLabel.height;
      this.setRowEmailRevealed(row, isOverPrivateEmail);

      if (touch.phase == TouchPhase.ENDED) {
        if (touch.cancelled) {
          return;
        }
        this.selectProfile(row.name, false);
        this.dispatchEventWith(Event.CHANGE, false, this.selectedProfile);
      }
    }

    @bound
    private setRowEmailRevealed(param1: Sprite, param2: boolean): void {
      var label: TextField = <TextField>this.rowEmailLabels.get(param1);
      var spoilerBlur: BlurFilter = <BlurFilter>this.rowEmailBlurFilters.get(param1);
      if (label != null && spoilerBlur != null) {
        if (param2) {
          if (label.filter != null) {
            label.filter = null;
          }
        } else if (label.filter !== spoilerBlur) {
          label.filter = spoilerBlur;
          // Detaching a cached Starling filter disposes its cached target
          // texture. Request a fresh cache whenever the spoiler is restored.
          spoilerBlur.cache();
        }
      }
    }

    @bound
    private clearRows(): void {
      var row: Sprite;
      while (this.rowsContainer.numChildren > 0) {
        row = <Sprite>this.rowsContainer.getChildAt(0);
        if (row != null) {
          row.removeEventListener('touch', this.onRowTouch);
          var label: TextField = <TextField>this.rowEmailLabels.get(row);
          var spoilerBlur: BlurFilter = <BlurFilter>this.rowEmailBlurFilters.get(row);
          if (label != null) {
            label.filter = null;
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
      var pinnedProfile: any = this.pinnedSteamProfile();
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
      param1.touchable = param2;
      param1.useHandCursor = param2;
      param1.alpha = param2 ? 1 : 0.35;
    }

    @bound
    private updateActions(): void {
      var profile: any = this.selectedProfile;
      this.editButton.enabled =
        profile != null && this.profileType(profile) == 'site' && this.profileEnabled(profile);
      this.removeButton.enabled = profile != null && this.profileRemovable(profile);
      this.loginButton.enabled = profile != null && this.profileEnabled(profile);
    }

    @bound
    private pinnedSteamProfile(): any {
      if (this._profiles.length > 0 && this.profileType(this._profiles[0]) == 'steam') {
        return this._profiles[0];
      }
      return null;
    }

    @bound
    private findProfile(param1: string | null): any {
      var profile: any;
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
    private profileId(param1: any): string {
      var value: any = this.profileProperty(param1, 'id', '');
      return value == null ? '' : String(value);
    }

    @bound
    private profileType(param1: any): string {
      var value: any = this.profileProperty(param1, 'type', '');
      return value == null ? '' : String(value).toLowerCase();
    }

    @bound
    private profileProviderBadge(param1: any): string {
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
    private profileEnabled(param1: any): boolean {
      return <boolean>this.profileProperty(param1, 'enabled', true);
    }

    @bound
    private profileRemovable(param1: any): boolean {
      if (this.profileType(param1) == 'steam') {
        return false;
      }
      return <boolean>this.profileProperty(param1, 'removable', true);
    }

    @bound
    private profileProperty(param1: any, param2: string, param3: any): any {
      if (param1 == null || !param1.hasOwnProperty(param2)) {
        return param3;
      }
      return param1[param2];
    }

    @bound
    private profileString(param1: any, param2: string, param3: string): string {
      var value: any = this.profileProperty(param1, param2, param3);
      return value == null ? param3 : String(value);
    }

    @bound
    private invokeCallback(
      param1: Function | null,
      param2: any = null,
      param3: boolean = false,
    ): void {
      if (param1 == null) {
        return;
      }
      if (param3 && param1.length > 0) {
        param1(param2);
      } else {
        param1();
      }
    }

    @bound
    /*override*/
    public dispose(): void {
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
