// Source port of qolaf/data/ClientSettings.as.
import { bound, type Resolve } from '../runtime/As3';
export function createClientSettings(resolve: Resolve): any {
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const SceneBase: any = resolve('core.scene.SceneBase');
  type SceneBase = any;
  const Point: any = resolve('openfl.geom.Point');
  type Point = any;
  const SharedObject: any = resolve('openfl.net.SharedObject');
  type SharedObject = any;

  class ClientSettings {
    public static SETTINGS_FILE: string = '\\qolaf\\local_settings.json';
    public static AUTO_TARGET: string = 'auto_target';
    public static TARGET_INFO_POSITION: string = 'target_info_position';
    public static TARGET_LIST_EXPANDED: string = 'target_list_expanded';
    public static NEARBY_ENEMY_RADAR_LINES: string = 'nearby_enemy_radar_lines';
    public static EXCLUDE_AF_FACTION_FROM_RADAR: string = 'exclude_af_faction_from_radar';
    public static DISABLE_NATIVE_BOSS_BAR: string = 'disable_native_boss_bar';
    public static DISABLE_SELECTED_TARGET_ICON: string = 'disable_selected_target_icon';
    public static TARGET_SEARCH_DISTANCE: string = 'target_search_distance';
    public static MULTIBAR_MODE: string = 'multibar_mode';
    public static MULTIBAR_DIVIDEND: string = 'multibar_dividend';
    public static EXPANDED_ARTIFACT_OVERVIEW: string = 'expanded_artifact_overview';
    public static DONT_KICK: string = 'dont_kick';
    public static ADVANCED_CHAT_TAB: string = 'advanced_chat_tab';
    public static SETTINGS_CATEGORY: string = 'settings_category';
    public static DISCORD_PRESENCE_ENABLED: string = 'discord_presence_enabled';
    public static DISCORD_PRESENCE_APPLICATION_ID: string = 'discord_presence_application_id';
    public static SHOW_BOSS_SPAWN_MARKERS: string = 'show_boss_spawn_markers';
    public static SHOW_SECONDARY_BOSS_TIMERS: string = 'show_secondary_boss_timers';
    public static SHOW_MINIBOSS_SPAWN_HEATMAP: string = 'show_miniboss_spawn_heatmap';
    public static SHOW_XHERSIX_TORPEDO_WARNINGS: string = 'show_xhersix_torpedo_warnings';
    public static SHOW_XHERSIX_TORPEDO_RHYTHM: string = 'showXhersixTorpedoRhythm';
    public static CORRECT_XHERSIX_TORPEDO_PREDICTION: string = 'correct_xhersix_torpedo_prediction';
    public static ANIMATE_TELEPORT_SCALING: string = 'animateTeleportScaling';
    public static DISABLE_REMASTERED_AURAS: string = 'disable_remastered_auras';
    public static MUSIC_PLAYER_STATE: string = 'music_player_state';
    public static SHOW_NETHER_BLOB_BEAM_COUNTDOWN: string = 'show_nether_blob_beam_countdown';
    public static SHOW_RADAR_FPS: string = 'show_radar_fps';
    public static SHOW_RADAR_LATENCY: string = 'show_radar_latency';
    public static SHOW_RADAR_DPS: string = 'show_radar_dps';
    public static SHOW_RADAR_SPEED: string = 'show_radar_speed';
    public static SHOW_RADAR_SERVICE: string = 'show_radar_service';
    public static RADAR_SPEED_IN_MPH: string = 'radar_speed_in_mph';
    public static SHOW_NEXAR_FACTION_LABELS: string = 'show_nexar_faction_labels';
    public static SHOW_NEXAR_ENEMY_NAMES: string = 'show_nexar_enemy_names';
    public static SHOW_NEXAR_HEALTH_BARS: string = 'show_nexar_health_bars';
    public static SHOW_NEXAR_HEALTH_VALUES: string = 'show_nexar_health_values';
    public static AIM_ASSIST_ENABLED: string = 'aim_assist_enabled';
    public static AIM_ASSIST_PROJECTILE_LEAD: string = 'aim_assist_projectile_lead';
    public static AIM_ASSIST_STATIONARY_TRACKING: string = 'aim_assist_stationary_tracking';
    public static AIM_ASSIST_PIN_LOCKED_TARGET: string = 'aim_assist_pin_locked_target';
    public static AIM_ASSIST_LOCKED_PROFILE: string = 'aim_assist_locked_profile';
    public static AIM_ASSIST_REQUIRE_ACTIVE_TARGET: string = 'aim_assist_require_active_target';
    public static AIM_ASSIST_DEBUG: string = 'aim_assist_debug';

    public static AIM_ASSIST_MIN_DISTANCE: string = 'aim_assist_min_distance';
    public static AIM_ASSIST_MIN_RANGE_RATIO: string = 'aim_assist_min_range_ratio';
    public static AIM_ASSIST_MIN_MOUSE_DELTA: string = 'aim_assist_min_mouse_delta';
    public static AIM_ASSIST_MAX_MOUSE_SPEED: string = 'aim_assist_max_mouse_speed';
    public static AIM_ASSIST_LOCKED_MIN_MOUSE_DELTA: string = 'aim_assist_locked_min_mouse_delta';
    public static AIM_ASSIST_LOCKED_MAX_MOUSE_SPEED: string = 'aim_assist_locked_max_mouse_speed';
    public static AIM_ASSIST_OVERRIDE_MOUSE_SPEED: string = 'aim_assist_override_mouse_speed';
    public static AIM_ASSIST_ACQUIRE_ANGLE: string = 'aim_assist_acquire_angle';
    public static AIM_ASSIST_LOCKED_ACQUIRE_ANGLE: string = 'aim_assist_locked_acquire_angle';
    public static AIM_ASSIST_RELEASE_ANGLE: string = 'aim_assist_release_angle';
    public static AIM_ASSIST_MAX_CORRECTION: string = 'aim_assist_max_correction';
    public static AIM_ASSIST_LOCKED_MAX_CORRECTION: string = 'aim_assist_locked_max_correction';
    public static AIM_ASSIST_CORRECTION_RATIO: string = 'aim_assist_correction_ratio';
    public static AIM_ASSIST_LOCKED_CORRECTION_RATIO: string = 'aim_assist_locked_correction_ratio';
    public static AIM_ASSIST_TURN_MARGIN_RATIO: string = 'aim_assist_turn_margin_ratio';
    public static AIM_ASSIST_TRACKING_DELAY: string = 'aim_assist_tracking_delay';
    public static AIM_ASSIST_LOCKED_TRACKING_DELAY: string = 'aim_assist_locked_tracking_delay';
    public static AIM_ASSIST_SIGNIFICANT_MOUSE_SPEED: string = 'aim_assist_significant_mouse_speed';
    public static AIM_ASSIST_TRACKING_RELEASE_ANGLE: string = 'aim_assist_tracking_release_angle';
    public static AIM_ASSIST_TRACKING_MAX_CORRECTION: string = 'aim_assist_tracking_max_correction';
    public static AIM_ASSIST_TRACKING_CORRECTION_RATIO: string =
      'aim_assist_tracking_correction_ratio';
    public static AIM_ASSIST_GUIDED_TURN_THRESHOLD_RATIO: string =
      'aim_assist_guided_turn_threshold_ratio';
    public static AIM_ASSIST_LOCKED_TURN_THRESHOLD_RATIO: string =
      'aim_assist_locked_turn_threshold_ratio';
    public static AIM_ASSIST_TRACKING_TURN_THRESHOLD_RATIO: string =
      'aim_assist_tracking_turn_threshold_ratio';
    public static AIM_ASSIST_TRACKING_SETTLE_STEPS: string = 'aim_assist_tracking_settle_steps';
    public static AIM_ASSIST_TRACKING_RESTART_STEPS: string = 'aim_assist_tracking_restart_steps';
    public static AIM_ASSIST_TOWARD_TOLERANCE: string = 'aim_assist_toward_tolerance';
    public static AIM_ASSIST_LOCKED_TOWARD_TOLERANCE: string = 'aim_assist_locked_toward_tolerance';
    public static AIM_ASSIST_MIN_HIT_WINDOW: string = 'aim_assist_min_hit_window';
    public static AIM_ASSIST_MAX_HIT_WINDOW: string = 'aim_assist_max_hit_window';
    public static AIM_ASSIST_MAX_LEAD_TIME: string = 'aim_assist_max_lead_time';

    public static DEFAULT_TARGET_SEARCH_DISTANCE: number = 2000;
    public static DEFAULT_TARGET_INFO_X: number = 0.96;
    public static DEFAULT_TARGET_INFO_Y: number = 0.07;
    public static DEFAULT_NEARBY_ENEMY_RADAR_LINES: number = 5;
    public static MIN_NEARBY_ENEMY_RADAR_LINES: number = 0;
    public static MAX_NEARBY_ENEMY_RADAR_LINES: number = 10;
    public static MIN_TARGET_SEARCH_DISTANCE: number = 100;
    public static MAX_TARGET_SEARCH_DISTANCE: number = 5000;
    public static DEFAULT_MULTIBAR_DIVIDEND: number = 10000;
    public static MIN_MULTIBAR_DIVIDEND: number = 1000;
    public static MAX_MULTIBAR_DIVIDEND: number = 100000;

    private static SHARED_OBJECT_NAME: string = 'QoLAFSettings';
    private static DEFAULT_PLAYER_ID: string = 'default';
    private static AIM_ASSIST_BOOLEAN_DEFAULTS: any =
      ClientSettings.createAimAssistBooleanDefaults();
    private static AIM_ASSIST_NUMBER_RANGES: any = ClientSettings.createAimAssistNumberRanges();

    private sharedObject!: SharedObject;
    private settingsObject: any = {};

    constructor(sceneBase: SceneBase = null) {
      this.sharedObject = SharedObject.getLocal(ClientSettings.SHARED_OBJECT_NAME);
      this.load();
    }

    @bound
    public load(): void {
      this.deserialize();
    }

    @bound
    public save(): void {
      this.serialize();
    }

    // Installation-local preferences; never uploaded or reset when changing accounts.
    public get discordPresenceEnabled(): boolean {
      // Default on for new/unset preferences; preserve a saved opt-out.
      return this.settingsObject[ClientSettings.DISCORD_PRESENCE_ENABLED] !== false;
    }

    public set discordPresenceEnabled(value: boolean) {
      this.settingsObject[ClientSettings.DISCORD_PRESENCE_ENABLED] = value;
      this.save();
    }

    public get discordPresenceApplicationId(): string {
      return typeof this.settingsObject[ClientSettings.DISCORD_PRESENCE_APPLICATION_ID] === 'string'
        ? String(this.settingsObject[ClientSettings.DISCORD_PRESENCE_APPLICATION_ID])
        : '';
    }

    public set discordPresenceApplicationId(value: string) {
      this.settingsObject[ClientSettings.DISCORD_PRESENCE_APPLICATION_ID] = value;
      this.save();
    }

    public get settingsCategory(): string {
      var values: any = this.getPlayerSettings(false);
      var category: string | null =
        values == null ? null : <string>values[ClientSettings.SETTINGS_CATEGORY];
      return ClientSettings.validSettingsCategory(category) ? category! : 'general';
    }

    public set settingsCategory(value: string) {
      if (!ClientSettings.validSettingsCategory(value) || this.settingsCategory == value) return;
      this.getPlayerSettings(true)[ClientSettings.SETTINGS_CATEGORY] = value;
      this.save();
    }

    @bound
    private static validSettingsCategory(value: string | null): boolean {
      switch (value) {
        case 'general':
        case 'graphics':
        case 'cosmetics':
        case 'hud':
        case 'combat':
        case 'chat':
        case 'bindings':
        case 'aim':
        case 'automations':
          return true;
        default:
          return false;
      }
    }

    /** Explicit account identity prevents late audio callbacks writing another account. */
    @bound
    public getMusicPlayerState(playerId: string): any {
      var values: any =
        ClientSettings.validMusicAccount(playerId) && this.settingsObject.hasOwnProperty(playerId)
          ? this.settingsObject[playerId]
          : null;
      return ClientSettings.normalizeMusicPlayerState(
        values == null ? null : values[ClientSettings.MUSIC_PLAYER_STATE],
      );
    }

    @bound
    public setMusicPlayerState(playerId: string, value: any): void {
      if (!ClientSettings.validMusicAccount(playerId)) return;
      var normalized: any = ClientSettings.normalizeMusicPlayerState(value);
      var previous: any = this.getMusicPlayerState(playerId);
      if (
        previous.manual == normalized.manual &&
        previous.trackKey == normalized.trackKey &&
        previous.selectedTrackKey == normalized.selectedTrackKey &&
        previous.loop == normalized.loop &&
        previous.state == normalized.state
      )
        return;
      if (!this.settingsObject.hasOwnProperty(playerId) || this.settingsObject[playerId] == null) {
        this.settingsObject[playerId] = this.buildDefaults();
      }
      this.settingsObject[playerId][ClientSettings.MUSIC_PLAYER_STATE] = normalized;
      this.save();
    }

    @bound
    private static validMusicAccount(playerId: string): boolean {
      return (
        playerId != null &&
        playerId.length > 0 &&
        playerId.length <= 256 &&
        playerId != ClientSettings.DEFAULT_PLAYER_ID
      );
    }

    @bound
    private static normalizeMusicPlayerState(value: any): any {
      if (value == null || typeof value != 'object') value = {};
      var key: string = ClientSettings.normalizeMusicTrackKey(value.trackKey);
      var selectedKey: string = ClientSettings.normalizeMusicTrackKey(value.selectedTrackKey);
      var manual: boolean =
        value.manual === true && (key != '' || value.trackKey == null || value.trackKey === '');
      var state: string =
        value.state == 'playing' || value.state == 'paused' ? value.state : 'stopped';
      return {
        manual: manual,
        trackKey: key,
        selectedTrackKey: selectedKey == '' ? key : selectedKey,
        loop: !value.hasOwnProperty('loop') || value.loop === true,
        state: manual ? state : 'stopped',
      };
    }

    @bound
    private static normalizeMusicTrackKey(value: any): string {
      return typeof value == 'string' && value.length <= 160 && !/[^A-Za-z0-9_-]/.test(value)
        ? value
        : '';
    }

    public get advancedChatTab(): any {
      var playerSettings: any = this.getPlayerSettings(false);
      return ClientSettings.normalizeChatTab(
        playerSettings == null ? null : playerSettings[ClientSettings.ADVANCED_CHAT_TAB],
      );
    }

    @bound
    public setAdvancedChatTab(mode: string, privateTarget: string = ''): void {
      var value: any = ClientSettings.normalizeChatTab({
        mode: mode,
        privateTarget: privateTarget,
      });
      var previous: any = this.advancedChatTab;
      if (previous.mode == value.mode && previous.privateTarget == value.privateTarget) {
        return;
      }
      this.getPlayerSettings(true)[ClientSettings.ADVANCED_CHAT_TAB] = value;
      this.save();
    }

    @bound
    private static normalizeChatTab(value: any): any {
      var mode: string | null =
        value != null && value.hasOwnProperty('mode') ? <string>value.mode : null;
      var target: string | null =
        value != null && value.hasOwnProperty('privateTarget') ? <string>value.privateTarget : null;
      switch (mode) {
        case 'local':
        case 'global':
        case 'qolaf':
        case 'clan':
        case 'group':
        case 'modchat':
          return { mode: mode, privateTarget: '' };
        case 'privateSaved':
          if (target != null && target.replace(/^\s+|\s+$/g, '').length > 0) {
            return { mode: mode, privateTarget: target };
          }
      }
      return { mode: 'local', privateTarget: '' };
    }

    public get autoTarget(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (playerSettings != null && playerSettings.hasOwnProperty(ClientSettings.AUTO_TARGET)) {
        return <boolean>playerSettings[ClientSettings.AUTO_TARGET];
      }
      return true;
    }

    public get showBossSpawnMarkers(): boolean {
      return this.defaultOn(ClientSettings.SHOW_BOSS_SPAWN_MARKERS);
    }

    public set showBossSpawnMarkers(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_BOSS_SPAWN_MARKERS] = value;
      this.save();
    }

    public get showSecondaryBossTimers(): boolean {
      var values: any = this.getPlayerSettings(false);
      return values != null && <boolean>values[ClientSettings.SHOW_SECONDARY_BOSS_TIMERS];
    }

    public set showSecondaryBossTimers(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_SECONDARY_BOSS_TIMERS] = value;
      this.save();
    }

    public get showMinibossSpawnHeatmap(): boolean {
      return this.defaultOn(ClientSettings.SHOW_MINIBOSS_SPAWN_HEATMAP);
    }

    public set showMinibossSpawnHeatmap(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_MINIBOSS_SPAWN_HEATMAP] = value;
      this.save();
    }

    public get showXhersixTorpedoWarnings(): boolean {
      return this.defaultOn(ClientSettings.SHOW_XHERSIX_TORPEDO_WARNINGS);
    }

    public set showXhersixTorpedoWarnings(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_XHERSIX_TORPEDO_WARNINGS] = value;
      this.save();
    }

    public get showXhersixTorpedoRhythm(): boolean {
      return this.defaultOn(ClientSettings.SHOW_XHERSIX_TORPEDO_RHYTHM);
    }

    public set showXhersixTorpedoRhythm(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_XHERSIX_TORPEDO_RHYTHM] = value;
      this.save();
    }

    public get correctXhersixTorpedoPrediction(): boolean {
      return this.defaultOn(ClientSettings.CORRECT_XHERSIX_TORPEDO_PREDICTION);
    }

    public set correctXhersixTorpedoPrediction(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.CORRECT_XHERSIX_TORPEDO_PREDICTION] = value;
      this.save();
    }

    public get animateTeleportScaling(): boolean {
      var values: any = this.getPlayerSettings(false);
      return values != null && <boolean>values[ClientSettings.ANIMATE_TELEPORT_SCALING];
    }

    public set animateTeleportScaling(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.ANIMATE_TELEPORT_SCALING] = value;
      this.save();
    }

    public get disableRemasteredAuras(): boolean {
      var values: any = this.getPlayerSettings(false);
      return values != null && <boolean>values[ClientSettings.DISABLE_REMASTERED_AURAS];
    }

    public set disableRemasteredAuras(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.DISABLE_REMASTERED_AURAS] = value;
      this.save();
    }

    public get showNetherBlobBeamCountdown(): boolean {
      return this.defaultOn(ClientSettings.SHOW_NETHER_BLOB_BEAM_COUNTDOWN);
    }

    public set showNetherBlobBeamCountdown(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_NETHER_BLOB_BEAM_COUNTDOWN] = value;
      this.save();
    }

    @bound
    private defaultOn(key: string): boolean {
      var values: any = this.getPlayerSettings(false);
      return values == null || !values.hasOwnProperty(key) || <boolean>values[key];
    }

    public get showRadarFPS(): boolean {
      return this.defaultOn(ClientSettings.SHOW_RADAR_FPS);
    }
    public set showRadarFPS(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_RADAR_FPS] = value;
      this.save();
    }

    public get showRadarLatency(): boolean {
      return this.defaultOn(ClientSettings.SHOW_RADAR_LATENCY);
    }
    public set showRadarLatency(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_RADAR_LATENCY] = value;
      this.save();
    }

    public get showRadarDPS(): boolean {
      return this.defaultOn(ClientSettings.SHOW_RADAR_DPS);
    }
    public set showRadarDPS(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_RADAR_DPS] = value;
      this.save();
    }

    public get showRadarSpeed(): boolean {
      return this.defaultOn(ClientSettings.SHOW_RADAR_SPEED);
    }
    public set showRadarSpeed(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_RADAR_SPEED] = value;
      this.save();
    }

    public get showRadarService(): boolean {
      return this.defaultOn(ClientSettings.SHOW_RADAR_SERVICE);
    }
    public set showRadarService(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_RADAR_SERVICE] = value;
      this.save();
    }

    public get radarSpeedInMph(): boolean {
      var values: any = this.getPlayerSettings(false);
      return values != null && <boolean>values[ClientSettings.RADAR_SPEED_IN_MPH];
    }
    public set radarSpeedInMph(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.RADAR_SPEED_IN_MPH] = value;
      this.save();
    }

    public get showNexarFactionLabels(): boolean {
      return this.defaultOn(ClientSettings.SHOW_NEXAR_FACTION_LABELS);
    }
    public set showNexarFactionLabels(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_NEXAR_FACTION_LABELS] = value;
      this.save();
    }

    public get showNexarEnemyNames(): boolean {
      return this.defaultOn(ClientSettings.SHOW_NEXAR_ENEMY_NAMES);
    }
    public set showNexarEnemyNames(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_NEXAR_ENEMY_NAMES] = value;
      this.save();
    }

    public get showNexarHealthBars(): boolean {
      return this.defaultOn(ClientSettings.SHOW_NEXAR_HEALTH_BARS);
    }
    public set showNexarHealthBars(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_NEXAR_HEALTH_BARS] = value;
      this.save();
    }

    public get showNexarHealthValues(): boolean {
      return this.defaultOn(ClientSettings.SHOW_NEXAR_HEALTH_VALUES);
    }
    public set showNexarHealthValues(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.SHOW_NEXAR_HEALTH_VALUES] = value;
      this.save();
    }

    public set autoTarget(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.AUTO_TARGET] = value;
      this.save();
    }

    public get targetInfoPosition(): Point {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.TARGET_INFO_POSITION)
      ) {
        var stored: any = playerSettings[ClientSettings.TARGET_INFO_POSITION];
        if (stored != null && stored.hasOwnProperty('x') && stored.hasOwnProperty('y')) {
          return new Point(
            ClientSettings.clampNormalized(Number(stored.x), ClientSettings.DEFAULT_TARGET_INFO_X),
            ClientSettings.clampNormalized(Number(stored.y), ClientSettings.DEFAULT_TARGET_INFO_Y),
          );
        }
      }
      return new Point(ClientSettings.DEFAULT_TARGET_INFO_X, ClientSettings.DEFAULT_TARGET_INFO_Y);
    }

    public set targetInfoPosition(value: Point) {
      if (value == null) {
        return;
      }
      this.getPlayerSettings(true)[ClientSettings.TARGET_INFO_POSITION] = {
        x: ClientSettings.clampNormalized(value.x, ClientSettings.DEFAULT_TARGET_INFO_X),
        y: ClientSettings.clampNormalized(value.y, ClientSettings.DEFAULT_TARGET_INFO_Y),
      };
      this.save();
    }

    public get targetListExpanded(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.TARGET_LIST_EXPANDED)
      ) {
        return <boolean>playerSettings[ClientSettings.TARGET_LIST_EXPANDED];
      }
      return true;
    }

    public set targetListExpanded(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.TARGET_LIST_EXPANDED] = value;
      this.save();
    }

    public get nearbyEnemyRadarLines(): number {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.NEARBY_ENEMY_RADAR_LINES)
      ) {
        return Number(
          Math.round(
            ClientSettings.clampNumber(
              Number(playerSettings[ClientSettings.NEARBY_ENEMY_RADAR_LINES]),
              ClientSettings.MIN_NEARBY_ENEMY_RADAR_LINES,
              ClientSettings.MAX_NEARBY_ENEMY_RADAR_LINES,
              ClientSettings.DEFAULT_NEARBY_ENEMY_RADAR_LINES,
            ),
          ),
        );
      }
      return ClientSettings.DEFAULT_NEARBY_ENEMY_RADAR_LINES;
    }

    public set nearbyEnemyRadarLines(value: number) {
      this.getPlayerSettings(true)[ClientSettings.NEARBY_ENEMY_RADAR_LINES] = Number(
        Math.round(
          ClientSettings.clampNumber(
            value,
            ClientSettings.MIN_NEARBY_ENEMY_RADAR_LINES,
            ClientSettings.MAX_NEARBY_ENEMY_RADAR_LINES,
            ClientSettings.DEFAULT_NEARBY_ENEMY_RADAR_LINES,
          ),
        ),
      );
      this.save();
    }

    public get excludeAFFactionFromRadar(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.EXCLUDE_AF_FACTION_FROM_RADAR)
      ) {
        return <boolean>playerSettings[ClientSettings.EXCLUDE_AF_FACTION_FROM_RADAR];
      }
      return true;
    }

    public set excludeAFFactionFromRadar(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.EXCLUDE_AF_FACTION_FROM_RADAR] = value;
      this.save();
    }

    public get disableNativeBossBar(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.DISABLE_NATIVE_BOSS_BAR)
      ) {
        return <boolean>playerSettings[ClientSettings.DISABLE_NATIVE_BOSS_BAR];
      }
      return true;
    }

    public set disableNativeBossBar(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.DISABLE_NATIVE_BOSS_BAR] = value;
      this.save();
    }

    public get disableSelectedTargetIcon(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.DISABLE_SELECTED_TARGET_ICON)
      ) {
        return <boolean>playerSettings[ClientSettings.DISABLE_SELECTED_TARGET_ICON];
      }
      return true;
    }

    public set disableSelectedTargetIcon(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.DISABLE_SELECTED_TARGET_ICON] = value;
      this.save();
    }

    public get targetSearchDistance(): number {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.TARGET_SEARCH_DISTANCE)
      ) {
        return ClientSettings.clampNumber(
          Number(playerSettings[ClientSettings.TARGET_SEARCH_DISTANCE]),
          ClientSettings.MIN_TARGET_SEARCH_DISTANCE,
          ClientSettings.MAX_TARGET_SEARCH_DISTANCE,
          ClientSettings.DEFAULT_TARGET_SEARCH_DISTANCE,
        );
      }
      return ClientSettings.DEFAULT_TARGET_SEARCH_DISTANCE;
    }

    public set targetSearchDistance(value: number) {
      this.getPlayerSettings(true)[ClientSettings.TARGET_SEARCH_DISTANCE] =
        ClientSettings.clampNumber(
          value,
          ClientSettings.MIN_TARGET_SEARCH_DISTANCE,
          ClientSettings.MAX_TARGET_SEARCH_DISTANCE,
          ClientSettings.DEFAULT_TARGET_SEARCH_DISTANCE,
        );
      this.save();
    }

    public get multibarMode(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (playerSettings != null && playerSettings.hasOwnProperty(ClientSettings.MULTIBAR_MODE)) {
        return <boolean>playerSettings[ClientSettings.MULTIBAR_MODE];
      }
      return true;
    }

    public set multibarMode(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.MULTIBAR_MODE] = value;
      this.save();
    }

    public get multibarDividend(): number {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.MULTIBAR_DIVIDEND)
      ) {
        return ClientSettings.clampNumber(
          Number(playerSettings[ClientSettings.MULTIBAR_DIVIDEND]),
          ClientSettings.MIN_MULTIBAR_DIVIDEND,
          ClientSettings.MAX_MULTIBAR_DIVIDEND,
          ClientSettings.DEFAULT_MULTIBAR_DIVIDEND,
        );
      }
      return ClientSettings.DEFAULT_MULTIBAR_DIVIDEND;
    }

    public set multibarDividend(value: number) {
      this.getPlayerSettings(true)[ClientSettings.MULTIBAR_DIVIDEND] = ClientSettings.clampNumber(
        value,
        ClientSettings.MIN_MULTIBAR_DIVIDEND,
        ClientSettings.MAX_MULTIBAR_DIVIDEND,
        ClientSettings.DEFAULT_MULTIBAR_DIVIDEND,
      );
      this.save();
    }

    public get expandedArtifactOverview(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (
        playerSettings != null &&
        playerSettings.hasOwnProperty(ClientSettings.EXPANDED_ARTIFACT_OVERVIEW)
      ) {
        return <boolean>playerSettings[ClientSettings.EXPANDED_ARTIFACT_OVERVIEW];
      }
      return true;
    }

    public set expandedArtifactOverview(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.EXPANDED_ARTIFACT_OVERVIEW] = value;
      this.save();
    }

    public get dontKick(): boolean {
      var playerSettings: any = this.getPlayerSettings(false);
      if (playerSettings != null && playerSettings.hasOwnProperty(ClientSettings.DONT_KICK)) {
        return <boolean>playerSettings[ClientSettings.DONT_KICK];
      }
      return false;
    }

    public set dontKick(value: boolean) {
      this.getPlayerSettings(true)[ClientSettings.DONT_KICK] = value;
      this.save();
    }

    public get aimAssistEnabled(): boolean {
      return this.getAimAssistBoolean(ClientSettings.AIM_ASSIST_ENABLED);
    }

    public set aimAssistEnabled(value: boolean) {
      this.setAimAssistBoolean(ClientSettings.AIM_ASSIST_ENABLED, value);
    }

    public get aimAssistProjectileLead(): boolean {
      return this.getAimAssistBoolean(ClientSettings.AIM_ASSIST_PROJECTILE_LEAD);
    }

    public get aimAssistStationaryTracking(): boolean {
      return this.getAimAssistBoolean(ClientSettings.AIM_ASSIST_STATIONARY_TRACKING);
    }

    public get aimAssistPinLockedTarget(): boolean {
      return this.getAimAssistBoolean(ClientSettings.AIM_ASSIST_PIN_LOCKED_TARGET);
    }

    public get aimAssistLockedProfile(): boolean {
      return this.getAimAssistBoolean(ClientSettings.AIM_ASSIST_LOCKED_PROFILE);
    }

    public get aimAssistRequireActiveTarget(): boolean {
      return this.getAimAssistBoolean(ClientSettings.AIM_ASSIST_REQUIRE_ACTIVE_TARGET);
    }

    public get aimAssistDebug(): boolean {
      return this.getAimAssistBoolean(ClientSettings.AIM_ASSIST_DEBUG);
    }

    public set aimAssistDebug(value: boolean) {
      this.setAimAssistBoolean(ClientSettings.AIM_ASSIST_DEBUG, value);
    }

    @bound
    public getAimAssistBoolean(key: string): boolean {
      if (!ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS.hasOwnProperty(key)) {
        return false;
      }
      var playerSettings: any = this.getPlayerSettings(false);
      if (playerSettings != null && playerSettings.hasOwnProperty(key)) {
        return <boolean>playerSettings[key];
      }
      return <boolean>ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS[key];
    }

    @bound
    public setAimAssistBoolean(key: string, value: boolean): void {
      if (!ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS.hasOwnProperty(key)) {
        return;
      }
      this.getPlayerSettings(true)[key] = value;
      this.save();
    }

    @bound
    public getAimAssistNumber(key: string): number {
      var range: any[] = <any[]>ClientSettings.AIM_ASSIST_NUMBER_RANGES[key];
      if (range == null) {
        return 0;
      }
      var playerSettings: any = this.getPlayerSettings(false);
      if (playerSettings != null && playerSettings.hasOwnProperty(key)) {
        return ClientSettings.clampNumber(
          Number(playerSettings[key]),
          Number(range[1]),
          Number(range[2]),
          Number(range[0]),
        );
      }
      return Number(range[0]);
    }

    @bound
    public setAimAssistNumber(key: string, value: number): void {
      var range: any[] = <any[]>ClientSettings.AIM_ASSIST_NUMBER_RANGES[key];
      if (range == null) {
        return;
      }
      this.getPlayerSettings(true)[key] = ClientSettings.clampNumber(
        value,
        Number(range[1]),
        Number(range[2]),
        Number(range[0]),
      );
      this.save();
    }

    @bound
    public static getAimAssistNumberDefault(key: string): number {
      var range: any[] = <any[]>ClientSettings.AIM_ASSIST_NUMBER_RANGES[key];
      return range == null ? 0 : Number(range[0]);
    }

    @bound
    public static getAimAssistNumberMinimum(key: string): number {
      var range: any[] = <any[]>ClientSettings.AIM_ASSIST_NUMBER_RANGES[key];
      return range == null ? 0 : Number(range[1]);
    }

    @bound
    public static getAimAssistNumberMaximum(key: string): number {
      var range: any[] = <any[]>ClientSettings.AIM_ASSIST_NUMBER_RANGES[key];
      return range == null ? 0 : Number(range[2]);
    }

    @bound
    public static getAimAssistBooleanDefault(key: string): boolean {
      return (
        ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS.hasOwnProperty(key) &&
        <boolean>ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS[key]
      );
    }

    @bound
    public resetAimAssistSettings(): void {
      var playerSettings: any = this.getPlayerSettings(true);
      var key: string;
      for (key in ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS) {
        playerSettings[key] = <boolean>ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS[key];
      }
      for (key in ClientSettings.AIM_ASSIST_NUMBER_RANGES) {
        playerSettings[key] = Number(ClientSettings.AIM_ASSIST_NUMBER_RANGES[key][0]);
      }
      this.save();
    }

    @bound
    public buildDefaults(): any {
      var defaults: any = {
        auto_target: true,
        target_info_position: {
          x: ClientSettings.DEFAULT_TARGET_INFO_X,
          y: ClientSettings.DEFAULT_TARGET_INFO_Y,
        },
        target_list_expanded: true,
        nearby_enemy_radar_lines: ClientSettings.DEFAULT_NEARBY_ENEMY_RADAR_LINES,
        exclude_af_faction_from_radar: true,
        disable_native_boss_bar: true,
        disable_selected_target_icon: true,
        target_search_distance: ClientSettings.DEFAULT_TARGET_SEARCH_DISTANCE,
        multibar_mode: true,
        multibar_dividend: ClientSettings.DEFAULT_MULTIBAR_DIVIDEND,
        expanded_artifact_overview: true,
        dont_kick: false,
      };
      defaults[ClientSettings.ADVANCED_CHAT_TAB] = { mode: 'local', privateTarget: '' };
      defaults[ClientSettings.SETTINGS_CATEGORY] = 'general';
      defaults[ClientSettings.SHOW_BOSS_SPAWN_MARKERS] = true;
      defaults[ClientSettings.SHOW_SECONDARY_BOSS_TIMERS] = false;
      defaults[ClientSettings.SHOW_XHERSIX_TORPEDO_WARNINGS] = true;
      defaults[ClientSettings.SHOW_XHERSIX_TORPEDO_RHYTHM] = true;
      defaults[ClientSettings.CORRECT_XHERSIX_TORPEDO_PREDICTION] = true;
      defaults[ClientSettings.ANIMATE_TELEPORT_SCALING] = false;
      defaults[ClientSettings.DISABLE_REMASTERED_AURAS] = false;
      defaults[ClientSettings.MUSIC_PLAYER_STATE] = {
        manual: false,
        trackKey: '',
        selectedTrackKey: '',
        loop: true,
        state: 'stopped',
      };
      defaults[ClientSettings.SHOW_NETHER_BLOB_BEAM_COUNTDOWN] = true;
      defaults[ClientSettings.SHOW_RADAR_FPS] = true;
      defaults[ClientSettings.SHOW_RADAR_LATENCY] = true;
      defaults[ClientSettings.SHOW_RADAR_DPS] = true;
      defaults[ClientSettings.SHOW_RADAR_SPEED] = true;
      defaults[ClientSettings.SHOW_RADAR_SERVICE] = true;
      defaults[ClientSettings.RADAR_SPEED_IN_MPH] = false;
      defaults[ClientSettings.SHOW_NEXAR_FACTION_LABELS] = true;
      defaults[ClientSettings.SHOW_NEXAR_ENEMY_NAMES] = true;
      defaults[ClientSettings.SHOW_NEXAR_HEALTH_BARS] = true;
      defaults[ClientSettings.SHOW_NEXAR_HEALTH_VALUES] = true;
      var key: string;
      for (key in ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS) {
        defaults[key] = <boolean>ClientSettings.AIM_ASSIST_BOOLEAN_DEFAULTS[key];
      }
      for (key in ClientSettings.AIM_ASSIST_NUMBER_RANGES) {
        defaults[key] = Number(ClientSettings.AIM_ASSIST_NUMBER_RANGES[key][0]);
      }
      return defaults;
    }

    @bound
    private serialize(): boolean {
      try {
        this.sharedObject.data.settings = this.settingsObject;
        this.sharedObject.flush();
        return true;
      } catch (error: any) {
        console.warn('Failed to serialize local QoLAF settings: ' + error.message);
      }
      return false;
    }

    @bound
    private deserialize(): boolean {
      try {
        if (
          this.sharedObject.data.hasOwnProperty('settings') &&
          this.sharedObject.data.settings != null
        ) {
          this.settingsObject = this.sharedObject.data.settings;
        } else {
          this.settingsObject = {};
        }
        return true;
      } catch (error: any) {
        console.warn('Failed to deserialize local QoLAF settings: ' + error.message);
        this.settingsObject = {};
      }
      return false;
    }

    @bound
    private getPlayerSettings(create: boolean): any {
      var playerId: string = ClientSettings.getCurrentPlayerId();
      if (!this.settingsObject.hasOwnProperty(playerId) || this.settingsObject[playerId] == null) {
        if (!create) {
          return null;
        }
        this.settingsObject[playerId] = this.buildDefaults();
      }
      return this.settingsObject[playerId];
    }

    @bound
    private static getCurrentPlayerId(): string {
      var game: Game = Game.instance;
      if (game != null && game.me != null && game.me.id != null && game.me.id.length > 0) {
        return game.me.id;
      }
      return ClientSettings.DEFAULT_PLAYER_ID;
    }

    @bound
    private static clampNormalized(value: number, fallback: number): number {
      if (isNaN(value) || !isFinite(value)) {
        return fallback;
      }
      return Math.max(0, Math.min(1, value));
    }

    @bound
    private static clampNumber(
      value: number,
      minimum: number,
      maximum: number,
      fallback: number,
    ): number {
      if (isNaN(value) || !isFinite(value)) {
        return fallback;
      }
      return Math.max(minimum, Math.min(maximum, value));
    }

    @bound
    private static createAimAssistBooleanDefaults(): any {
      var defaults: any = {};
      defaults[ClientSettings.AIM_ASSIST_ENABLED] = false;
      defaults[ClientSettings.AIM_ASSIST_PROJECTILE_LEAD] = true;
      defaults[ClientSettings.AIM_ASSIST_STATIONARY_TRACKING] = true;
      defaults[ClientSettings.AIM_ASSIST_PIN_LOCKED_TARGET] = true;
      defaults[ClientSettings.AIM_ASSIST_LOCKED_PROFILE] = true;
      defaults[ClientSettings.AIM_ASSIST_REQUIRE_ACTIVE_TARGET] = true;
      defaults[ClientSettings.AIM_ASSIST_DEBUG] = false;
      return defaults;
    }

    @bound
    private static createAimAssistNumberRanges(): any {
      var ranges: any = {};
      ranges[ClientSettings.AIM_ASSIST_MIN_DISTANCE] = [150, 0, 1000];
      ranges[ClientSettings.AIM_ASSIST_MIN_RANGE_RATIO] = [0.15, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_MIN_MOUSE_DELTA] = [0.0003, 0, 0.003];
      ranges[ClientSettings.AIM_ASSIST_MAX_MOUSE_SPEED] = [1.35, 0.1, 5];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_MIN_MOUSE_DELTA] = [0.0001, 0, 0.003];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_MAX_MOUSE_SPEED] = [2.1, 0.1, 5];
      ranges[ClientSettings.AIM_ASSIST_OVERRIDE_MOUSE_SPEED] = [2.6, 0.5, 8];
      ranges[ClientSettings.AIM_ASSIST_ACQUIRE_ANGLE] = [
        0.20943951023931953, 0.017453292519943295, 0.7853981633974483,
      ];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_ACQUIRE_ANGLE] = [
        0.3490658503988659, 0.017453292519943295, 1.0471975511965976,
      ];
      ranges[ClientSettings.AIM_ASSIST_RELEASE_ANGLE] = [
        0.3141592653589793, 0.017453292519943295, 1.0471975511965976,
      ];
      ranges[ClientSettings.AIM_ASSIST_MAX_CORRECTION] = [
        0.13962634015954636, 0, 0.7853981633974483,
      ];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_MAX_CORRECTION] = [
        0.2792526803190927, 0, 1.0471975511965976,
      ];
      ranges[ClientSettings.AIM_ASSIST_CORRECTION_RATIO] = [0.85, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_CORRECTION_RATIO] = [0.95, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_TURN_MARGIN_RATIO] = [0.35, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_TRACKING_DELAY] = [120, 0, 1000];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_TRACKING_DELAY] = [40, 0, 500];
      ranges[ClientSettings.AIM_ASSIST_SIGNIFICANT_MOUSE_SPEED] = [0.22, 0, 2];
      ranges[ClientSettings.AIM_ASSIST_TRACKING_RELEASE_ANGLE] = [
        0.5235987755982988, 0.08726646259971647, 1.5707963267948966,
      ];
      ranges[ClientSettings.AIM_ASSIST_TRACKING_MAX_CORRECTION] = [
        0.41887902047863906, 0, 1.5707963267948966,
      ];
      ranges[ClientSettings.AIM_ASSIST_TRACKING_CORRECTION_RATIO] = [1, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_GUIDED_TURN_THRESHOLD_RATIO] = [0.65, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_TURN_THRESHOLD_RATIO] = [0.45, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_TRACKING_TURN_THRESHOLD_RATIO] = [0.35, 0, 1];
      ranges[ClientSettings.AIM_ASSIST_TRACKING_SETTLE_STEPS] = [1.25, 0.5, 4];
      ranges[ClientSettings.AIM_ASSIST_TRACKING_RESTART_STEPS] = [2, 0.5, 6];
      ranges[ClientSettings.AIM_ASSIST_TOWARD_TOLERANCE] = [0.0015, 0, 0.02];
      ranges[ClientSettings.AIM_ASSIST_LOCKED_TOWARD_TOLERANCE] = [0.006, 0, 0.03];
      ranges[ClientSettings.AIM_ASSIST_MIN_HIT_WINDOW] = [650, 100, 3000];
      ranges[ClientSettings.AIM_ASSIST_MAX_HIT_WINDOW] = [1200, 100, 5000];
      ranges[ClientSettings.AIM_ASSIST_MAX_LEAD_TIME] = [2, 0, 5];
      return ranges;
    }
  }

  return ClientSettings;
}
