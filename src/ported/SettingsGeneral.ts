// Source port of core/states/gameStates/SettingsGeneral.as.
import { bound, type Resolve } from '../runtime/As3';
export function createSettingsGeneral(resolve: Resolve): any {
  const RymdenRunt: any = resolve('RymdenRunt');
  type RymdenRunt = any;
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const SceneBase: any = resolve('core.scene.SceneBase');
  type SceneBase = any;
  const BodyManager: any = resolve('core.solarSystem.BodyManager');
  type BodyManager = any;
  const Settings: any = resolve('data.Settings');
  type Settings = any;
  const Check: any = resolve('feathers.controls.Check');
  type Check = any;
  const ScrollContainer: any = resolve('feathers.controls.ScrollContainer');
  type ScrollContainer = any;
  const Slider: any = resolve('feathers.controls.Slider');
  type Slider = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  const SettingsQoLAF: any = resolve('qolaf.states.SettingsQoLAF');
  type SettingsQoLAF = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;

  class SettingsGeneral extends Sprite {
    private static START_HEIGHT: number = 20;
    private static START_WIDTH: number = 20;
    private g!: Game;
    private currentHeight: number = 20;
    private currentWidth: number = 20;
    private settings!: Settings;
    private musicSlider!: Slider;
    private effectSlider!: Slider;
    private frameRateSlider!: Slider;
    private frameRateText!: Text;
    private dpiSlider!: Slider;
    private dpiText!: Text;
    private backgroundOpacitySlider!: Slider;
    private backgroundOpacityText!: Text;
    private starBrightnessSlider!: Slider;
    private starBrightnessText!: Text;
    private showHud!: Check;
    private showEffects!: Check;
    private showLatency!: Check;
    private showBackground!: Check;
    private showBlackHoleDistortion!: Check;
    private formatDamageText!: Check;
    private formatHealthAndShield!: Check;
    private formatTargetBarValues!: Check;
    private showPlayerClanIdentification!: Check;
    private mouseAim!: Check;
    private keyboardAim!: Check;
    private rotationSlider!: Slider;
    private rotationSpeedText!: Text;
    private iWantAllTimedMissions!: Check;
    private fireWithHotkeys!: Check;
    private compactWarpGateUI!: Check;
    private disableSpaceToRespawn!: Check;
    private scrollArea!: ScrollContainer;

    constructor(game: Game, category: string = 'general') {
      super();
      this.g = game;
      this.settings = SceneBase.settings;
      this.scrollArea = new ScrollContainer();
      this.scrollArea.y = 50;
      this.scrollArea.x = 8;
      this.scrollArea.width = 730;
      this.scrollArea.height = 500;
      this.initComponents(category);
      this.addChild(this.scrollArea);
      if (category == 'general' || category == 'hud' || category == 'combat') {
        // Controls belong to this scroll area; the empty helper owns its listeners.
        this.addChild(new SettingsQoLAF(this.g, category, this.scrollArea, this.currentHeight));
      }
    }

    @bound
    private initComponents(category: string): void {
      switch (category) {
        case 'graphics':
          this.addGraphicsSettings();
          break;
        case 'cosmetics':
          this.addCosmeticsSettings();
          break;
        case 'hud':
          this.addHudSettings();
          break;
        case 'combat':
          this.addCombatSettings();
          break;
        default:
          this.addGeneralSettings();
          break;
      }
    }

    @bound
    private addGeneralSettings(): void {
      var rotationValue: number;
      this.musicSlider = new Slider();
      this.addSlider(this.musicSlider, this.settings.musicVolume, Localize.t('Music Volume'));
      this.musicSlider.addEventListener('change', (param1: Event): void => {
        this.settings.musicVolume = this.musicSlider.value;
      });
      this.effectSlider = new Slider();
      this.addSlider(this.effectSlider, this.settings.effectVolume, Localize.t('Effect Volume'));
      this.effectSlider.addEventListener('change', (param1: Event): void => {
        this.settings.effectVolume = this.effectSlider.value;
      });
      this.mouseAim = new Check();
      this.mouseAim.isSelected = !this.settings.mouseAim;
      this.mouseAim.addEventListener('change', (param1: Event): void => {
        this.settings.mouseAim = !this.mouseAim.isSelected;
      });
      this.addCheckbox(this.mouseAim, Localize.t('Disable Mouse Aim'));
      this.fireWithHotkeys = new Check();
      this.fireWithHotkeys.isSelected = this.settings.fireWithHotkeys;
      this.fireWithHotkeys.addEventListener('change', (param1: Event): void => {
        this.settings.fireWithHotkeys = this.fireWithHotkeys.isSelected;
      });
      this.addCheckbox(this.fireWithHotkeys, Localize.t('Fire with Weapon Hotkeys'));
      this.disableSpaceToRespawn = new Check();
      this.disableSpaceToRespawn.isSelected = this.settings.disableSpaceToRespawn;
      this.disableSpaceToRespawn.addEventListener('change', (param1: Event): void => {
        this.settings.disableSpaceToRespawn = this.disableSpaceToRespawn.isSelected;
      });
      this.addCheckbox(this.disableSpaceToRespawn, Localize.t('Disable Space to Respawn'));
      this.rotationSlider = new Slider();
      rotationValue = (this.settings.rotationSpeed - 0.75) * 2;
      this.addSlider(
        this.rotationSlider,
        rotationValue,
        Localize.t('Player Rotation Speed'),
        0,
        1,
        0.1,
        true,
      );
      this.rotationSlider.addEventListener('change', (param1: Event): void => {
        this.settings.rotationSpeed = 0.75 + 0.5 * this.rotationSlider.value;
        this.rotationSpeedText.text = this.settings.rotationSpeed.toFixed(2);
      });
      this.rotationSpeedText = new Text(this.rotationSlider.x + 120, this.rotationSlider.y + 26);
      this.rotationSpeedText.text = this.settings.rotationSpeed.toFixed(2);
      this.scrollArea.addChild(this.rotationSpeedText);
      this.iWantAllTimedMissions = new Check();
      this.iWantAllTimedMissions.isSelected = this.settings.iWantAllTimedMissions;
      this.iWantAllTimedMissions.addEventListener('change', (param1: Event): void => {
        this.settings.iWantAllTimedMissions = this.iWantAllTimedMissions.isSelected;
      });
      this.addCheckbox(this.iWantAllTimedMissions, Localize.t('I want all timed missions.'));
    }

    @bound
    private addGraphicsSettings(): void {
      this.frameRateSlider = new Slider();
      this.addSlider(
        this.frameRateSlider,
        this.settings.renderFrameRate,
        Localize.t('Frame Rate Limit'),
        30,
        RymdenRunt.UNLIMITED_FRAME_RATE,
        1,
        true,
      );
      this.frameRateSlider.addEventListener('change', (param1: Event): void => {
        this.settings.renderFrameRate = Number(this.frameRateSlider.value);
        this.updateFrameRateText();
      });
      this.frameRateText = new Text(this.frameRateSlider.x + 120, this.frameRateSlider.y + 26);
      this.updateFrameRateText();
      this.scrollArea.addChild(this.frameRateText);
      this.dpiSlider = new Slider();
      this.addSlider(
        this.dpiSlider,
        this.settings.dpiScale,
        Localize.t('DPI Scale'),
        RymdenRunt.MIN_DPI_SCALE,
        RymdenRunt.MAX_DPI_SCALE,
        0.05,
        true,
      );
      this.dpiSlider.addEventListener('change', (param1: Event): void => {
        this.settings.dpiScale = Number(this.dpiSlider.value.toFixed(2));
        this.updateDPIText();
      });
      this.dpiText = new Text(this.dpiSlider.x + 120, this.dpiSlider.y + 26);
      this.updateDPIText();
      this.scrollArea.addChild(this.dpiText);
      this.showEffects = new Check();
      this.showEffects.isSelected = this.settings.showEffects;
      this.showEffects.addEventListener('change', (param1: Event): void => {
        this.settings.showEffects = this.showEffects.isSelected;
        this.g.toggleHighGraphics(this.settings.showEffects);
      });
      this.addCheckbox(
        this.showEffects,
        Localize.t(
          "High graphic settings <font color=\'#a1a1a1\'>(uncheck for better performance)</font>",
        ),
      );
    }

    @bound
    private addCosmeticsSettings(): void {
      var distortionLabel: Text;
      this.showBackground = new Check();
      this.showBackground.isSelected = this.settings.showBackground;
      this.showBackground.addEventListener('change', (param1: Event): void => {
        this.settings.showBackground = this.showBackground.isSelected;
        this.g.parallaxManager.refresh();
      });
      this.addCheckbox(
        this.showBackground,
        Localize.t(
          "Show Background <font color=\'#a1a1a1\'>(uncheck for better performance)</font>",
        ),
      );
      this.backgroundOpacitySlider = new Slider();
      this.addSlider(
        this.backgroundOpacitySlider,
        this.settings.backgroundOpacity,
        Localize.t('Background Opacity'),
        0,
        1,
        0.05,
        true,
      );
      this.backgroundOpacitySlider.addEventListener('change', (param1: Event): void => {
        this.settings.backgroundOpacity = this.backgroundOpacitySlider.value;
        this.updateBackgroundOpacityText();
      });
      this.backgroundOpacityText = new Text(
        this.backgroundOpacitySlider.x + 120,
        this.backgroundOpacitySlider.y + 26,
      );
      this.updateBackgroundOpacityText();
      this.scrollArea.addChild(this.backgroundOpacityText);
      this.starBrightnessSlider = new Slider();
      this.addSlider(
        this.starBrightnessSlider,
        this.settings.starBrightness,
        Localize.t('Star Brightness'),
        0,
        1,
        0.05,
        true,
      );
      this.starBrightnessSlider.addEventListener('change', (param1: Event): void => {
        this.settings.starBrightness = this.starBrightnessSlider.value;
        this.updateStarBrightnessText();
      });
      this.starBrightnessText = new Text(
        this.starBrightnessSlider.x + 120,
        this.starBrightnessSlider.y + 26,
      );
      this.updateStarBrightnessText();
      this.scrollArea.addChild(this.starBrightnessText);
      this.showBlackHoleDistortion = new Check();
      this.showBlackHoleDistortion.isSelected = this.settings.showBlackHoleDistortion;
      this.showBlackHoleDistortion.isEnabled = BodyManager.DISTORTION_EFFECTS_AVAILABLE;
      if (BodyManager.DISTORTION_EFFECTS_AVAILABLE) {
        this.showBlackHoleDistortion.addEventListener('change', (param1: Event): void => {
          this.settings.showBlackHoleDistortion = this.showBlackHoleDistortion.isSelected;
        });
      }
      distortionLabel = this.addCheckbox(
        this.showBlackHoleDistortion,
        Localize.t('Black Hole Distortion Effects') +
          (BodyManager.DISTORTION_EFFECTS_AVAILABLE
            ? ''
            : " <font color='#a1a1a1'>(disabled for maintenance)</font>"),
      );
      this.showBlackHoleDistortion.useHandCursor = BodyManager.DISTORTION_EFFECTS_AVAILABLE;
      distortionLabel.alpha = BodyManager.DISTORTION_EFFECTS_AVAILABLE ? 1 : 0.5;
      var teleportScaling: Check = new Check();
      teleportScaling.isSelected = SceneBase.clientSettings.animateTeleportScaling;
      teleportScaling.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.animateTeleportScaling = teleportScaling.isSelected;
      });
      this.addCheckbox(
        teleportScaling,
        'Shrink / grow teleport animation<br/>' +
          "<font color='#a1a1a1' size='11'>After channeling: off waits 240ms; on shrinks 120ms, jumps, then grows 120ms.</font>",
      );
      this.currentHeight += 16;
      var vanillaAuras: Check = new Check();
      vanillaAuras.isSelected = SceneBase.clientSettings.disableRemasteredAuras;
      this.addCheckbox(
        vanillaAuras,
        'Disable remastered auras<br/>' +
          "<font color='#a1a1a1' size='11'>Restore original aura pulses and rendering. No flowing borders or aura lightning.</font>",
      );
      vanillaAuras.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.disableRemasteredAuras = vanillaAuras.isSelected;
      });
    }

    @bound
    private addHudSettings(): void {
      this.showHud = new Check();
      this.showHud.isSelected = this.settings.showHud;
      this.showHud.addEventListener('change', (param1: Event): void => {
        this.settings.showHud = this.showHud.isSelected;
      });
      this.addCheckbox(this.showHud, Localize.t('Show Hud'));
      var radarFPS: Check = new Check();
      radarFPS.isSelected = SceneBase.clientSettings.showRadarFPS;
      radarFPS.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showRadarFPS = radarFPS.isSelected;
      });
      this.addCheckbox(radarFPS, 'Show frames/sec above the radar');
      var radarLatency: Check = new Check();
      radarLatency.isSelected = SceneBase.clientSettings.showRadarLatency;
      radarLatency.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showRadarLatency = radarLatency.isSelected;
      });
      this.addCheckbox(radarLatency, 'Show latency above the radar');
      var radarDPS: Check = new Check();
      radarDPS.isSelected = SceneBase.clientSettings.showRadarDPS;
      radarDPS.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showRadarDPS = radarDPS.isSelected;
      });
      this.addCheckbox(radarDPS, 'Show estimated direct-hit DPS above the radar (last 5 seconds)');
      var radarSpeed: Check = new Check();
      radarSpeed.isSelected = SceneBase.clientSettings.showRadarSpeed;
      radarSpeed.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showRadarSpeed = radarSpeed.isSelected;
      });
      this.addCheckbox(radarSpeed, 'Show current speed above the radar');
      var radarService: Check = new Check();
      radarService.isSelected = SceneBase.clientSettings.showRadarService;
      radarService.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showRadarService = radarService.isSelected;
      });
      this.addCheckbox(radarService, 'Show connected Service room above the radar');
      var radarMph: Check = new Check();
      radarMph.isSelected = SceneBase.clientSettings.radarSpeedInMph;
      radarMph.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.radarSpeedInMph = radarMph.isSelected;
      });
      this.addCheckbox(radarMph, 'Display radar speed in mph (unchecked: km/h)');
      var nexarFaction: Check = new Check();
      nexarFaction.isSelected = SceneBase.clientSettings.showNexarFactionLabels;
      nexarFaction.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showNexarFactionLabels = nexarFaction.isSelected;
      });
      this.addCheckbox(nexarFaction, 'Show important Nexar faction labels and icons');
      var nexarNames: Check = new Check();
      nexarNames.isSelected = SceneBase.clientSettings.showNexarEnemyNames;
      nexarNames.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showNexarEnemyNames = nexarNames.isSelected;
      });
      this.addCheckbox(nexarNames, 'Show important Nexar enemy names');
      var nexarBars: Check = new Check();
      nexarBars.isSelected = SceneBase.clientSettings.showNexarHealthBars;
      nexarBars.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showNexarHealthBars = nexarBars.isSelected;
      });
      this.addCheckbox(nexarBars, 'Show important Nexar shield and health bars');
      var nexarValues: Check = new Check();
      nexarValues.isSelected = SceneBase.clientSettings.showNexarHealthValues;
      nexarValues.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showNexarHealthValues = nexarValues.isSelected;
      });
      this.addCheckbox(nexarValues, 'Show important Nexar shield and health values');
      this.showLatency = new Check();
      this.showLatency.isSelected = this.settings.showLatency;
      this.showLatency.addEventListener('change', (param1: Event): void => {
        this.settings.showLatency = this.showLatency.isSelected;
      });
      this.addCheckbox(this.showLatency, Localize.t('Show Latency/fps'));
      this.formatDamageText = new Check();
      this.formatDamageText.isSelected = this.settings.formatDamageText;
      this.formatDamageText.addEventListener('change', (param1: Event): void => {
        this.settings.formatDamageText = this.formatDamageText.isSelected;
      });
      this.addCheckbox(
        this.formatDamageText,
        Localize.t("Format damage and healing text <font color='#a1a1a1'>(compact numbers)</font>"),
      );
      this.formatHealthAndShield = new Check();
      this.formatHealthAndShield.isSelected = this.settings.formatHealthAndShield;
      this.formatHealthAndShield.addEventListener('change', (param1: Event): void => {
        this.settings.formatHealthAndShield = this.formatHealthAndShield.isSelected;
      });
      this.addCheckbox(
        this.formatHealthAndShield,
        Localize.t(
          "Format player health and shield values <font color='#a1a1a1'>(compact numbers)</font>",
        ),
      );
      this.formatTargetBarValues = new Check();
      this.formatTargetBarValues.isSelected = this.settings.formatTargetBarValues;
      this.formatTargetBarValues.addEventListener('change', (param1: Event): void => {
        this.settings.formatTargetBarValues = this.formatTargetBarValues.isSelected;
      });
      this.addCheckbox(
        this.formatTargetBarValues,
        Localize.t(
          "Format target bar values <font color='#a1a1a1'>(compact k/M/B/T numbers)</font>",
        ),
      );
      this.showPlayerClanIdentification = new Check();
      this.showPlayerClanIdentification.isSelected = this.settings.showPlayerClanIdentification;
      this.showPlayerClanIdentification.addEventListener('change', (param1: Event): void => {
        this.settings.showPlayerClanIdentification = this.showPlayerClanIdentification.isSelected;
      });
      this.addCheckbox(
        this.showPlayerClanIdentification,
        Localize.t('Enable clan identifications on player names'),
      );
      this.compactWarpGateUI = new Check();
      this.compactWarpGateUI.isSelected = this.settings.compactWarpGateUI;
      this.compactWarpGateUI.addEventListener('change', (param1: Event): void => {
        this.settings.compactWarpGateUI = this.compactWarpGateUI.isSelected;
      });
      this.addCheckbox(
        this.compactWarpGateUI,
        Localize.t(
          "Use Compact Warp Gate Map <font color=\'#a1a1a1\'>(uncheck for the default map)</font>",
        ),
      );
    }

    @bound
    private addCombatSettings(): void {
      var bossMarkers: Check = new Check();
      bossMarkers.isSelected = SceneBase.clientSettings.showBossSpawnMarkers;
      bossMarkers.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showBossSpawnMarkers = bossMarkers.isSelected;
      });
      this.addCheckbox(bossMarkers, 'Boss and hidden miniboss spawn markers');
      var minibossHeatmap: Check = new Check();
      minibossHeatmap.isSelected = SceneBase.clientSettings.showMinibossSpawnHeatmap;
      minibossHeatmap.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showMinibossSpawnHeatmap = minibossHeatmap.isSelected;
      });
      this.addCheckbox(minibossHeatmap, 'Spawner miniboss heatmap (potential spawn areas)');
      var torpedoWarnings: Check = new Check();
      torpedoWarnings.isSelected = SceneBase.clientSettings.showXhersixTorpedoWarnings;
      torpedoWarnings.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showXhersixTorpedoWarnings = torpedoWarnings.isSelected;
      });
      this.addCheckbox(torpedoWarnings, 'Emperor Xhersix torpedo collision circles');
      var torpedoRhythm: Check = new Check();
      torpedoRhythm.isSelected = SceneBase.clientSettings.showXhersixTorpedoRhythm;
      torpedoRhythm.addEventListener('change', (event: Event): void => {
        var enabled: boolean = torpedoRhythm.isSelected;
        SceneBase.clientSettings.showXhersixTorpedoRhythm = enabled;
        if (this.g.projectileManager != null) {
          this.g.projectileManager.setTorpedoCueEnabled(enabled);
        }
      });
      this.addCheckbox(
        torpedoRhythm,
        'Xhersix torpedo rhythm rings (visual only)<br/>' +
          "<font color='#a1a1a1' size='11'>2.5s; realigns at 50ms drift. Resets on target change or over 3s silence.</font>",
      );
      this.currentHeight += 16;
      var torpedoPrediction: Check = new Check();
      torpedoPrediction.isSelected = SceneBase.clientSettings.correctXhersixTorpedoPrediction;
      torpedoPrediction.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.correctXhersixTorpedoPrediction = torpedoPrediction.isSelected;
      });
      this.addCheckbox(
        torpedoPrediction,
        'Correct Xhersix torpedo positioning<br/>' +
          "<font color='#a1a1a1'>Applies to newly spawned torpedoes; disable for legacy positioning.</font>",
      );
      this.currentHeight += 16;
      var beamCountdown: Check = new Check();
      beamCountdown.isSelected = SceneBase.clientSettings.showNetherBlobBeamCountdown;
      beamCountdown.addEventListener('change', (event: Event): void => {
        SceneBase.clientSettings.showNetherBlobBeamCountdown = beamCountdown.isSelected;
      });
      this.addCheckbox(beamCountdown, '??? (Nether Blob) estimated beam countdown');
    }

    @bound
    private addQualitySlider(): void {
      var labelText: Text;
      var descText: Text;
      var slider: Slider = new Slider();
      slider.minimum = 0;
      slider.maximum = 5;
      slider.step = 1;
      slider.value = this.settings.quality;
      slider.direction = 'horizontal';
      slider.useHandCursor = true;
      labelText = new Text();
      labelText.htmlText = Localize.t('Quality');
      labelText.y = this.currentHeight;
      labelText.x = this.currentWidth;
      slider.x = labelText.x + labelText.width + 10;
      slider.y = this.currentHeight;
      descText = new Text();
      switch (slider.value) {
        case 0:
          RymdenRunt.s.nativeStage.quality = 'low';
          RymdenRunt.s.antiAliasing = 0;
          descText.htmlText = Localize.t('Low');
          break;
        case 1:
          RymdenRunt.s.nativeStage.quality = 'medium';
          RymdenRunt.s.antiAliasing = 2;
          descText.htmlText = Localize.t('Medium');
          break;
        case 2:
          RymdenRunt.s.nativeStage.quality = 'high';
          RymdenRunt.s.antiAliasing = 4;
          descText.htmlText = Localize.t('High, AAx4');
          break;
        case 3:
          RymdenRunt.s.nativeStage.quality = '8x8';
          RymdenRunt.s.antiAliasing = 8;
          descText.htmlText = Localize.t('High, AAx8');
          break;
        case 4:
          RymdenRunt.s.nativeStage.quality = '16x16';
          RymdenRunt.s.antiAliasing = 16;
          descText.htmlText = Localize.t('High, AAx16');
          break;
        case 5:
          RymdenRunt.s.nativeStage.quality = 'best';
          RymdenRunt.s.antiAliasing = 16;
          descText.htmlText = Localize.t('Best, AAx16');
      }
      descText.y = this.currentHeight;
      descText.x = slider.x + slider.width;
      if (slider.x < 200) {
        slider.x = 200;
      }
      this.scrollArea.addChild(labelText);
      this.scrollArea.addChild(slider);
      this.scrollArea.addChild(descText);
      this.currentHeight += 40;
      slider.addEventListener('change', (param1: Event): void => {
        this.settings.quality = slider.value;
        switch (slider.value) {
          case 0:
            RymdenRunt.s.nativeStage.quality = 'low';
            RymdenRunt.s.antiAliasing = 0;
            descText.htmlText = Localize.t('Low');
            break;
          case 1:
            RymdenRunt.s.nativeStage.quality = 'medium';
            RymdenRunt.s.antiAliasing = 2;
            descText.htmlText = Localize.t('Medium');
            break;
          case 2:
            RymdenRunt.s.nativeStage.quality = 'high';
            RymdenRunt.s.antiAliasing = 4;
            descText.htmlText = Localize.t('High, AAx4');
            break;
          case 3:
            RymdenRunt.s.nativeStage.quality = '8x8';
            RymdenRunt.s.antiAliasing = 8;
            descText.htmlText = Localize.t('High, AAx8');
            break;
          case 4:
            RymdenRunt.s.nativeStage.quality = '16x16';
            RymdenRunt.s.antiAliasing = 16;
            descText.htmlText = Localize.t('High, AAx16');
            break;
          case 5:
            RymdenRunt.s.nativeStage.quality = 'best';
            RymdenRunt.s.antiAliasing = 16;
            descText.htmlText = Localize.t('Best, AAx16');
        }
      });
    }

    @bound
    private addCheckbox(param1: Check, param2: string): Text {
      var local3: Text = new Text();
      local3.htmlText = param2;
      local3.y = this.currentHeight;
      local3.x = this.currentWidth + 30;
      param1.x = this.currentWidth;
      param1.y = this.currentHeight - 4;
      param1.useHandCursor = true;
      this.scrollArea.addChild(local3);
      this.scrollArea.addChild(param1);
      this.currentHeight += 40;
      return local3;
    }

    @bound
    private updateFrameRateText(): void {
      if (this.settings.renderFrameRate >= RymdenRunt.UNLIMITED_FRAME_RATE) {
        this.frameRateText.text = Localize.t('Unlimited');
      } else {
        this.frameRateText.text = this.settings.renderFrameRate + ' FPS';
      }
    }

    @bound
    private updateBackgroundOpacityText(): void {
      this.backgroundOpacityText.text = Math.round(this.settings.backgroundOpacity * 100) + '%';
    }

    @bound
    private updateStarBrightnessText(): void {
      this.starBrightnessText.text = Math.round(this.settings.starBrightness * 100) + '%';
    }

    @bound
    private updateDPIText(): void {
      this.dpiText.text = Math.round(this.settings.dpiScale * 100) + '%';
    }

    @bound
    private addSlider(
      param1: Slider,
      param2: number,
      param3: string,
      param4: number = 0,
      param5: number = 1,
      param6: number = 0.1,
      hasValueText: boolean = false,
    ): void {
      param1.minimum = param4;
      param1.maximum = param5;
      param1.step = param6;
      param1.value = param2;
      param1.direction = 'horizontal';
      param1.useHandCursor = true;
      var local4: Text = new Text();
      local4.htmlText = param3;
      local4.y = this.currentHeight;
      local4.x = this.currentWidth;
      param1.x = local4.x + local4.width + 10;
      param1.y = this.currentHeight;
      if (param1.x < 200) {
        param1.x = 200;
      }
      this.scrollArea.addChild(local4);
      this.scrollArea.addChild(param1);
      // Only reserve a second line when there is a value below the track.
      this.currentHeight += hasValueText ? 56 : 32;
    }
  }

  return SettingsGeneral;
}
