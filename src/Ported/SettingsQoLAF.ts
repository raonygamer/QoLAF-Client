// Source port of qolaf/states/SettingsQoLAF.as.
import { bound, type Resolve } from '../Runtime/As3';
export function createSettingsQoLAF(resolve: Resolve): any {
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const SceneBase: any = resolve('core.scene.SceneBase');
  type SceneBase = any;
  const PlayState: any = resolve('core.states.gameStates.PlayState');
  type PlayState = any;
  const Check: any = resolve('feathers.controls.Check');
  type Check = any;
  const ScrollContainer: any = resolve('feathers.controls.ScrollContainer');
  type ScrollContainer = any;
  const Slider: any = resolve('feathers.controls.Slider');
  type Slider = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  const ClientSettings: any = resolve('qolaf.data.ClientSettings');
  type ClientSettings = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;

  class SettingsQoLAF extends Sprite {
    private static VIEWPORT_WIDTH: number = 730;
    private static CONTENT_Y: number = 50;
    private static VIEWPORT_HEIGHT: number = 500;

    private clientSettings!: ClientSettings;
    private game!: Game;
    private currentHeight: number = 20;
    private currentWidth: number = 20;
    private scrollArea!: ScrollContainer;
    private aimAssistToggleBindings: any[] = [];
    private aimAssistSliderBindings: any[] = [];
    private autoTarget!: Check;
    private nearbyTargetsExpanded!: Check;
    private nearbyEnemyRadarLines!: Slider;
    private nearbyEnemyRadarLinesText!: Text;
    private excludeAFFactionFromRadar!: Check;
    private disableNativeBossBar!: Check;
    private disableSelectedTargetIcon!: Check;
    private targetSearchDistance!: Slider;
    private targetSearchDistanceText!: Text;
    private multibarMode!: Check;
    private multibarDividend!: Slider;
    private multibarDividendText!: Text;
    private targetInfoX!: Slider;
    private targetInfoXText!: Text;
    private targetInfoY!: Slider;
    private targetInfoYText!: Text;
    private expandedArtifactOverview!: Check;
    private dontKick!: Check;
    private discordPresence!: Check;

    /** Shared areas keep their own geometry and child ownership; this Sprite
     * remains the parent page's disposable owner of control listeners. */
    constructor(
      game: Game,
      category: string = 'aim',
      sharedScrollArea: ScrollContainer = null,
      startHeight: number = 20,
    ) {
      super();
      this.game = game;
      if (SceneBase.clientSettings == null) {
        SceneBase.clientSettings = new ClientSettings(game);
      }
      this.clientSettings = SceneBase.clientSettings;
      this.currentHeight = isFinite(startHeight) && startHeight >= 0 ? startHeight : 20;
      this.scrollArea = sharedScrollArea;
      if (this.scrollArea == null) {
        this.scrollArea = this.createScrollArea();
        this.addChild(this.scrollArea);
      }
      switch (category) {
        case 'general':
          this.initGeneralComponents();
          break;
        case 'hud':
          this.initHudComponents();
          break;
        case 'combat':
          this.initCombatComponents();
          break;
        default:
          this.initAimAssistComponents();
          break;
      }
    }

    public get contentHeight(): number {
      return this.currentHeight;
    }

    @bound
    private createScrollArea(): ScrollContainer {
      var area: ScrollContainer = new ScrollContainer();
      area.x = 8;
      area.y = SettingsQoLAF.CONTENT_Y;
      area.width = SettingsQoLAF.VIEWPORT_WIDTH;
      area.height = SettingsQoLAF.VIEWPORT_HEIGHT;
      return area;
    }

    @bound
    private initGeneralComponents(): void {
      this.dontKick = new Check();
      this.dontKick.isSelected = this.clientSettings.dontKick;
      this.dontKick.addEventListener(Event.CHANGE, this.onDontKickChanged);
      this.addCheckbox(this.dontKick, Localize.t('Prevent inactivity disconnect (/dontkick)'));
      this.discordPresence = new Check();
      this.discordPresence.isSelected = this.clientSettings.discordPresenceEnabled;
      this.discordPresence.addEventListener(Event.CHANGE, this.onDiscordPresenceChanged);
      this.addCheckbox(
        this.discordPresence,
        'Discord Rich Presence (system + boss status; /discordpresence status)',
      );
    }

    @bound
    private onDiscordPresenceChanged(event: Event): void {
      this.clientSettings.discordPresenceEnabled = this.discordPresence.isSelected;
    }

    @bound
    private initCombatComponents(): void {
      this.addSectionTitle(Localize.t('Target system'));
      this.autoTarget = new Check();
      this.autoTarget.isSelected = this.clientSettings.autoTarget;
      this.autoTarget.addEventListener(Event.CHANGE, this.onAutoTargetChanged);
      this.addCheckbox(this.autoTarget, Localize.t('Enable auto target'));

      this.targetSearchDistance = new Slider();
      this.addSlider(
        this.targetSearchDistance,
        this.clientSettings.targetSearchDistance,
        Localize.t('Enemy search distance'),
        ClientSettings.MIN_TARGET_SEARCH_DISTANCE,
        ClientSettings.MAX_TARGET_SEARCH_DISTANCE,
        100,
      );
      this.targetSearchDistanceText = new Text(
        this.targetSearchDistance.x + 120,
        this.targetSearchDistance.y + 26,
      );
      this.updateTargetSearchDistanceText();
      this.targetSearchDistance.addEventListener(Event.CHANGE, this.onTargetSearchDistanceChanged);
      this.scrollArea.addChild(this.targetSearchDistanceText);
    }

    @bound
    private initHudComponents(): void {
      this.addSectionTitle(Localize.t('Target display'));
      this.nearbyTargetsExpanded = new Check();
      this.nearbyTargetsExpanded.isSelected = this.clientSettings.targetListExpanded;
      this.nearbyTargetsExpanded.addEventListener(
        Event.CHANGE,
        this.onNearbyTargetsExpandedChanged,
      );
      this.addCheckbox(this.nearbyTargetsExpanded, Localize.t('Show nearby target rows'));

      this.nearbyEnemyRadarLines = new Slider();
      this.addSlider(
        this.nearbyEnemyRadarLines,
        this.clientSettings.nearbyEnemyRadarLines,
        Localize.t('Nearby enemy radar lines'),
        ClientSettings.MIN_NEARBY_ENEMY_RADAR_LINES,
        ClientSettings.MAX_NEARBY_ENEMY_RADAR_LINES,
        1,
      );
      this.nearbyEnemyRadarLinesText = new Text(
        this.nearbyEnemyRadarLines.x + 120,
        this.nearbyEnemyRadarLines.y + 26,
      );
      this.updateNearbyEnemyRadarLinesText();
      this.nearbyEnemyRadarLines.addEventListener(
        Event.CHANGE,
        this.onNearbyEnemyRadarLinesChanged,
      );
      this.scrollArea.addChild(this.nearbyEnemyRadarLinesText);

      this.excludeAFFactionFromRadar = new Check();
      this.excludeAFFactionFromRadar.isSelected = this.clientSettings.excludeAFFactionFromRadar;
      this.excludeAFFactionFromRadar.addEventListener(
        Event.CHANGE,
        this.onExcludeAFFactionFromRadarChanged,
      );
      this.addCheckbox(this.excludeAFFactionFromRadar, Localize.t('Exclude AF faction from radar'));

      this.disableNativeBossBar = new Check();
      this.disableNativeBossBar.isSelected = this.clientSettings.disableNativeBossBar;
      this.disableNativeBossBar.addEventListener(Event.CHANGE, this.onDisableNativeBossBarChanged);
      this.addCheckbox(this.disableNativeBossBar, Localize.t('Disable native boss bar'));

      this.disableSelectedTargetIcon = new Check();
      this.disableSelectedTargetIcon.isSelected = this.clientSettings.disableSelectedTargetIcon;
      this.disableSelectedTargetIcon.addEventListener(
        Event.CHANGE,
        this.onDisableSelectedTargetIconChanged,
      );
      this.addCheckbox(
        this.disableSelectedTargetIcon,
        Localize.t('Disable selected target icon around target'),
      );

      this.multibarMode = new Check();
      this.multibarMode.isSelected = this.clientSettings.multibarMode;
      this.multibarMode.addEventListener(Event.CHANGE, this.onMultibarModeChanged);
      this.addCheckbox(this.multibarMode, Localize.t('Enable multibar mode'));

      this.multibarDividend = new Slider();
      this.addSlider(
        this.multibarDividend,
        this.clientSettings.multibarDividend,
        Localize.t('Dividend amount'),
        ClientSettings.MIN_MULTIBAR_DIVIDEND,
        ClientSettings.MAX_MULTIBAR_DIVIDEND,
        1000,
      );
      this.multibarDividendText = new Text(
        this.multibarDividend.x + 120,
        this.multibarDividend.y + 26,
      );
      this.updateMultibarDividendText();
      this.multibarDividend.addEventListener(Event.CHANGE, this.onMultibarDividendChanged);
      this.scrollArea.addChild(this.multibarDividendText);

      this.targetInfoX = new Slider();
      this.addSlider(
        this.targetInfoX,
        this.clientSettings.targetInfoPosition.x,
        Localize.t('Target info X position'),
      );
      this.targetInfoXText = new Text(this.targetInfoX.x + 120, this.targetInfoX.y + 26);
      this.targetInfoXText.text = this.clientSettings.targetInfoPosition.x.toFixed(2);
      this.targetInfoX.addEventListener(Event.CHANGE, this.onTargetInfoXChanged);
      this.scrollArea.addChild(this.targetInfoXText);

      this.targetInfoY = new Slider();
      this.addSlider(
        this.targetInfoY,
        this.clientSettings.targetInfoPosition.y,
        Localize.t('Target info Y position'),
      );
      this.targetInfoYText = new Text(this.targetInfoY.x + 120, this.targetInfoY.y + 26);
      this.targetInfoYText.text = this.clientSettings.targetInfoPosition.y.toFixed(2);
      this.targetInfoY.addEventListener(Event.CHANGE, this.onTargetInfoYChanged);
      this.scrollArea.addChild(this.targetInfoYText);

      this.currentHeight += 20;
      var interfaceTitle: Text = new Text();
      interfaceTitle.text = Localize.t('Client interface');
      interfaceTitle.size = 18;
      interfaceTitle.x = this.currentWidth;
      interfaceTitle.y = this.currentHeight;
      this.scrollArea.addChild(interfaceTitle);
      this.currentHeight += 40;

      this.expandedArtifactOverview = new Check();
      this.expandedArtifactOverview.isSelected = this.clientSettings.expandedArtifactOverview;
      this.expandedArtifactOverview.addEventListener(
        Event.CHANGE,
        this.onExpandedArtifactOverviewChanged,
      );
      this.addCheckbox(this.expandedArtifactOverview, Localize.t('Use expanded artifact overview'));
    }

    @bound
    private initAimAssistComponents(): void {
      this.addSectionTitle(Localize.t('Aim Assist'));
      this.addAimAssistToggle(ClientSettings.AIM_ASSIST_ENABLED, Localize.t('Enable aim assist'));
      this.addAimAssistDisclaimer();

      this.addAimAssistToggle(
        ClientSettings.AIM_ASSIST_PROJECTILE_LEAD,
        Localize.t('Predict projectile lead against moving targets'),
      );
      this.addAimAssistToggle(
        ClientSettings.AIM_ASSIST_STATIONARY_TRACKING,
        Localize.t('Track while the mouse remains still'),
      );
      this.addAimAssistToggle(
        ClientSettings.AIM_ASSIST_PIN_LOCKED_TARGET,
        Localize.t('Pin the manually locked target'),
      );
      this.addAimAssistToggle(
        ClientSettings.AIM_ASSIST_LOCKED_PROFILE,
        Localize.t('Use lower hysteresis for locked targets'),
      );
      this.addAimAssistToggle(
        ClientSettings.AIM_ASSIST_REQUIRE_ACTIVE_TARGET,
        Localize.t('Require the hit target to be selected'),
      );
      this.addAimAssistToggle(
        ClientSettings.AIM_ASSIST_DEBUG,
        Localize.t('Show aim-assist debug overlay'),
      );

      this.addSectionTitle(Localize.t('Acquisition'));
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MIN_DISTANCE,
        Localize.t('Minimum target distance'),
        10,
        1,
        0,
        'm',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MIN_RANGE_RATIO,
        Localize.t('Minimum weapon-range distance'),
        0.01,
        100,
        0,
        '%',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MIN_MOUSE_DELTA,
        Localize.t('Minimum mouse movement'),
        0.00005,
        1000,
        2,
        ' mrad',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MAX_MOUSE_SPEED,
        Localize.t('Maximum acquisition mouse speed'),
        0.05,
        1,
        2,
        ' rad/s',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_ACQUIRE_ANGLE,
        Localize.t('Acquisition cone'),
        SettingsQoLAF.radians(1),
        SettingsQoLAF.degreesScale(),
        0,
        ' deg',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_RELEASE_ANGLE,
        Localize.t('Release cone'),
        SettingsQoLAF.radians(1),
        SettingsQoLAF.degreesScale(),
        0,
        ' deg',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TOWARD_TOLERANCE,
        Localize.t('Toward-target tolerance'),
        0.0005,
        1000,
        1,
        ' mrad',
      );

      this.addSectionTitle(Localize.t('Correction and steering'));
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_CORRECTION_RATIO,
        Localize.t('Correction strength'),
        0.05,
        100,
        0,
        '%',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MAX_CORRECTION,
        Localize.t('Maximum correction'),
        SettingsQoLAF.radians(1),
        SettingsQoLAF.degreesScale(),
        0,
        ' deg',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_OVERRIDE_MOUSE_SPEED,
        Localize.t('Manual override mouse speed'),
        0.1,
        1,
        2,
        ' rad/s',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_GUIDED_TURN_THRESHOLD_RATIO,
        Localize.t('Guided turn deadzone'),
        0.05,
        100,
        0,
        '%',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TURN_MARGIN_RATIO,
        Localize.t('Deadzone crossing margin'),
        0.05,
        100,
        0,
        '%',
      );

      this.addSectionTitle(Localize.t('Stationary tracking'));
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TRACKING_DELAY,
        Localize.t('Tracking delay'),
        10,
        1,
        0,
        ' ms',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_SIGNIFICANT_MOUSE_SPEED,
        Localize.t('Significant mouse speed'),
        0.02,
        1,
        2,
        ' rad/s',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TRACKING_RELEASE_ANGLE,
        Localize.t('Tracking release cone'),
        SettingsQoLAF.radians(1),
        SettingsQoLAF.degreesScale(),
        0,
        ' deg',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TRACKING_CORRECTION_RATIO,
        Localize.t('Tracking correction strength'),
        0.05,
        100,
        0,
        '%',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TRACKING_MAX_CORRECTION,
        Localize.t('Tracking maximum correction'),
        SettingsQoLAF.radians(1),
        SettingsQoLAF.degreesScale(),
        0,
        ' deg',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TRACKING_TURN_THRESHOLD_RATIO,
        Localize.t('Tracking turn deadzone'),
        0.05,
        100,
        0,
        '%',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TRACKING_SETTLE_STEPS,
        Localize.t('Tracking settle radius'),
        0.05,
        1,
        2,
        ' turn steps',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_TRACKING_RESTART_STEPS,
        Localize.t('Tracking restart radius'),
        0.05,
        1,
        2,
        ' turn steps',
      );

      this.addSectionTitle(Localize.t('Locked-target profile'));
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_MIN_MOUSE_DELTA,
        Localize.t('Locked minimum mouse movement'),
        0.00005,
        1000,
        2,
        ' mrad',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_MAX_MOUSE_SPEED,
        Localize.t('Locked maximum acquisition speed'),
        0.05,
        1,
        2,
        ' rad/s',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_ACQUIRE_ANGLE,
        Localize.t('Locked acquisition cone'),
        SettingsQoLAF.radians(1),
        SettingsQoLAF.degreesScale(),
        0,
        ' deg',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_CORRECTION_RATIO,
        Localize.t('Locked correction strength'),
        0.05,
        100,
        0,
        '%',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_MAX_CORRECTION,
        Localize.t('Locked maximum correction'),
        SettingsQoLAF.radians(1),
        SettingsQoLAF.degreesScale(),
        0,
        ' deg',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_TRACKING_DELAY,
        Localize.t('Locked tracking delay'),
        10,
        1,
        0,
        ' ms',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_TURN_THRESHOLD_RATIO,
        Localize.t('Locked turn deadzone'),
        0.05,
        100,
        0,
        '%',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_LOCKED_TOWARD_TOLERANCE,
        Localize.t('Locked toward-target tolerance'),
        0.0005,
        1000,
        1,
        ' mrad',
      );

      this.addSectionTitle(Localize.t('Hit and lead timing'));
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MIN_HIT_WINDOW,
        Localize.t('Minimum hit memory'),
        50,
        1,
        0,
        ' ms',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MAX_HIT_WINDOW,
        Localize.t('Maximum hit memory'),
        50,
        1,
        0,
        ' ms',
      );
      this.addAimAssistSlider(
        ClientSettings.AIM_ASSIST_MAX_LEAD_TIME,
        Localize.t('Maximum lead prediction'),
        0.1,
        1,
        1,
        ' s',
      );
      this.currentHeight += 20;
    }

    @bound
    private addAimAssistDisclaimer(): void {
      var disclaimer: Text = new Text(0, 0, true, 'Verdana');
      disclaimer.text = Localize.t(
        'Aim assist supports mouse aim and keyboard steering, ' +
          'but never works against player-controlled ships. It only steers toward ' +
          'eligible hostile NPC targets.',
      );
      disclaimer.color = 0xbbbbbb;
      disclaimer.size = 11;
      disclaimer.width = 610;
      disclaimer.x = this.currentWidth + 30;
      disclaimer.y = this.currentHeight - 12;
      this.scrollArea.addChild(disclaimer);
      this.currentHeight += disclaimer.height + 20;
    }

    @bound
    private addSectionTitle(label: string): void {
      if (this.currentHeight > 20) {
        this.currentHeight += 12;
      }
      var title: Text = new Text();
      title.text = label;
      title.size = 18;
      title.x = this.currentWidth;
      title.y = this.currentHeight;
      this.scrollArea.addChild(title);
      this.currentHeight += 40;
    }

    @bound
    private addAimAssistToggle(key: string, label: string): void {
      var box: Check = new Check();
      box.isSelected = this.clientSettings.getAimAssistBoolean(key);
      var binding: any = { key: key, control: box };
      this.aimAssistToggleBindings.push(binding);
      box.addEventListener(Event.CHANGE, this.onAimAssistToggleChanged);
      this.addCheckbox(box, label);
    }

    @bound
    private onAimAssistToggleChanged(event: Event): void {
      var box: Check = <Check>event.currentTarget;
      for (const binding of this.aimAssistToggleBindings) {
        if (binding.control == box) {
          this.clientSettings.setAimAssistBoolean(String(binding.key), box.isSelected);
          if (
            binding.key == ClientSettings.AIM_ASSIST_DEBUG &&
            this.game != null &&
            this.game.gameStateMachine != null
          ) {
            var playState: PlayState = <PlayState>this.game.gameStateMachine.activeState;
            if (playState != null) {
              playState.applyAimAssistDebugVisibility();
            }
          }
          return;
        }
      }
    }

    @bound
    private addAimAssistSlider(
      key: string,
      label: string,
      step: number,
      displayScale: number,
      decimals: number,
      suffix: string,
    ): void {
      var slider: Slider = new Slider();
      this.addSlider(
        slider,
        this.clientSettings.getAimAssistNumber(key),
        label,
        ClientSettings.getAimAssistNumberMinimum(key),
        ClientSettings.getAimAssistNumberMaximum(key),
        step,
      );
      var valueText: Text = new Text(slider.x + 120, slider.y + 26);
      var binding: any = {
        key: key,
        control: slider,
        text: valueText,
        displayScale: displayScale,
        decimals: decimals,
        suffix: suffix,
      };
      this.aimAssistSliderBindings.push(binding);
      this.updateAimAssistSliderText(binding);
      slider.addEventListener(Event.CHANGE, this.onAimAssistSliderChanged);
      this.scrollArea.addChild(valueText);
    }

    @bound
    private onAimAssistSliderChanged(event: Event): void {
      var slider: Slider = <Slider>event.currentTarget;
      for (const binding of this.aimAssistSliderBindings) {
        if (binding.control == slider) {
          this.clientSettings.setAimAssistNumber(String(binding.key), slider.value);
          this.updateAimAssistSliderText(binding);
          return;
        }
      }
    }

    @bound
    private updateAimAssistSliderText(binding: any): void {
      var slider: Slider = <Slider>binding.control;
      var valueText: Text = <Text>binding.text;
      valueText.text =
        (slider.value * Number(binding.displayScale)).toFixed(Number(binding.decimals)) +
        String(binding.suffix);
    }

    @bound
    private static radians(degrees: number): number {
      return (degrees * Math.PI) / 180;
    }

    @bound
    private static degreesScale(): number {
      return 180 / Math.PI;
    }

    @bound
    private onAutoTargetChanged(event: Event): void {
      this.clientSettings.autoTarget = this.autoTarget.isSelected;
    }

    @bound
    private onNearbyTargetsExpandedChanged(event: Event): void {
      this.clientSettings.targetListExpanded = this.nearbyTargetsExpanded.isSelected;
    }

    @bound
    private onNearbyEnemyRadarLinesChanged(event: Event): void {
      this.clientSettings.nearbyEnemyRadarLines = Number(
        Math.round(this.nearbyEnemyRadarLines.value),
      );
      this.updateNearbyEnemyRadarLinesText();
    }

    @bound
    private updateNearbyEnemyRadarLinesText(): void {
      this.nearbyEnemyRadarLinesText.text = this.clientSettings.nearbyEnemyRadarLines.toString();
    }

    @bound
    private onExcludeAFFactionFromRadarChanged(event: Event): void {
      this.clientSettings.excludeAFFactionFromRadar = this.excludeAFFactionFromRadar.isSelected;
    }

    @bound
    private onDisableNativeBossBarChanged(event: Event): void {
      this.clientSettings.disableNativeBossBar = this.disableNativeBossBar.isSelected;
    }

    @bound
    private onDisableSelectedTargetIconChanged(event: Event): void {
      this.clientSettings.disableSelectedTargetIcon = this.disableSelectedTargetIcon.isSelected;
    }

    @bound
    private onTargetSearchDistanceChanged(event: Event): void {
      this.clientSettings.targetSearchDistance = this.targetSearchDistance.value;
      this.updateTargetSearchDistanceText();
    }

    @bound
    private updateTargetSearchDistanceText(): void {
      this.targetSearchDistanceText.text =
        Math.round(this.clientSettings.targetSearchDistance) + 'm';
    }

    @bound
    private onMultibarModeChanged(event: Event): void {
      this.clientSettings.multibarMode = this.multibarMode.isSelected;
    }

    @bound
    private onMultibarDividendChanged(event: Event): void {
      this.clientSettings.multibarDividend = this.multibarDividend.value;
      this.updateMultibarDividendText();
    }

    @bound
    private updateMultibarDividendText(): void {
      this.multibarDividendText.text = Math.round(this.clientSettings.multibarDividend).toString();
    }

    @bound
    private onTargetInfoXChanged(event: Event): void {
      this.clientSettings.targetInfoPosition = new Point(
        this.targetInfoX.value,
        this.clientSettings.targetInfoPosition.y,
      );
      this.targetInfoXText.text = this.clientSettings.targetInfoPosition.x.toFixed(2);
    }

    @bound
    private onTargetInfoYChanged(event: Event): void {
      this.clientSettings.targetInfoPosition = new Point(
        this.clientSettings.targetInfoPosition.x,
        this.targetInfoY.value,
      );
      this.targetInfoYText.text = this.clientSettings.targetInfoPosition.y.toFixed(2);
    }

    @bound
    private onExpandedArtifactOverviewChanged(event: Event): void {
      this.clientSettings.expandedArtifactOverview = this.expandedArtifactOverview.isSelected;
    }

    @bound
    private onDontKickChanged(event: Event): void {
      this.game.setInactivityDisconnectPrevention(this.dontKick.isSelected);
    }

    @bound
    private addCheckbox(box: Check, label: string): void {
      var text: Text = new Text();
      text.text = label;
      text.x = this.currentWidth + 30;
      text.y = this.currentHeight;
      box.x = this.currentWidth;
      box.y = this.currentHeight - 4;
      box.useHandCursor = true;
      this.scrollArea.addChild(text);
      this.scrollArea.addChild(box);
      this.currentHeight += 40;
    }

    @bound
    private addSlider(
      slider: Slider,
      value: number,
      label: string,
      minimum: number = 0,
      maximum: number = 1,
      step: number = 0.001,
    ): void {
      slider.minimum = minimum;
      slider.maximum = maximum;
      slider.step = step;
      slider.value = value;
      slider.direction = 'horizontal';
      slider.useHandCursor = true;
      var text: Text = new Text();
      text.text = label;
      text.x = this.currentWidth;
      text.y = this.currentHeight;
      slider.x = Math.max(220, text.x + text.width + 10);
      slider.y = this.currentHeight;
      this.scrollArea.addChild(text);
      this.scrollArea.addChild(slider);
      this.currentHeight += 56;
    }

    @bound
    /*override*/
    public dispose(): void {
      for (const toggleBinding of this.aimAssistToggleBindings) {
        (toggleBinding.control as Check).removeEventListener(
          Event.CHANGE,
          this.onAimAssistToggleChanged,
        );
      }
      for (const sliderBinding of this.aimAssistSliderBindings) {
        (sliderBinding.control as Slider).removeEventListener(
          Event.CHANGE,
          this.onAimAssistSliderChanged,
        );
      }
      if (this.autoTarget != null) {
        this.autoTarget.removeEventListener(Event.CHANGE, this.onAutoTargetChanged);
      }
      if (this.targetInfoX != null) {
        this.targetInfoX.removeEventListener(Event.CHANGE, this.onTargetInfoXChanged);
      }
      if (this.nearbyTargetsExpanded != null) {
        this.nearbyTargetsExpanded.removeEventListener(
          Event.CHANGE,
          this.onNearbyTargetsExpandedChanged,
        );
      }
      if (this.nearbyEnemyRadarLines != null) {
        this.nearbyEnemyRadarLines.removeEventListener(
          Event.CHANGE,
          this.onNearbyEnemyRadarLinesChanged,
        );
      }
      if (this.excludeAFFactionFromRadar != null) {
        this.excludeAFFactionFromRadar.removeEventListener(
          Event.CHANGE,
          this.onExcludeAFFactionFromRadarChanged,
        );
      }
      if (this.disableNativeBossBar != null) {
        this.disableNativeBossBar.removeEventListener(
          Event.CHANGE,
          this.onDisableNativeBossBarChanged,
        );
      }
      if (this.disableSelectedTargetIcon != null) {
        this.disableSelectedTargetIcon.removeEventListener(
          Event.CHANGE,
          this.onDisableSelectedTargetIconChanged,
        );
      }
      if (this.targetSearchDistance != null) {
        this.targetSearchDistance.removeEventListener(
          Event.CHANGE,
          this.onTargetSearchDistanceChanged,
        );
      }
      if (this.multibarMode != null) {
        this.multibarMode.removeEventListener(Event.CHANGE, this.onMultibarModeChanged);
      }
      if (this.multibarDividend != null) {
        this.multibarDividend.removeEventListener(Event.CHANGE, this.onMultibarDividendChanged);
      }
      if (this.targetInfoY != null) {
        this.targetInfoY.removeEventListener(Event.CHANGE, this.onTargetInfoYChanged);
      }
      if (this.expandedArtifactOverview != null) {
        this.expandedArtifactOverview.removeEventListener(
          Event.CHANGE,
          this.onExpandedArtifactOverviewChanged,
        );
      }
      if (this.dontKick != null) {
        this.dontKick.removeEventListener(Event.CHANGE, this.onDontKickChanged);
      }
      if (this.discordPresence != null) {
        this.discordPresence.removeEventListener(Event.CHANGE, this.onDiscordPresenceChanged);
      }
      if (this.clientSettings != null) {
        this.clientSettings.save();
      }
      this.aimAssistToggleBindings.length = 0;
      this.aimAssistSliderBindings.length = 0;
      this.game = null;
      this.clientSettings = null;
      // A shared area's controls are disposed by its owning page, never here.
      this.scrollArea = null;
      super.dispose();
    }
  }

  return SettingsQoLAF;
}
