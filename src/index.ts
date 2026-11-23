import { installRewardRates } from './telemetry/NativeRewardRates';
import { installWeaponAcknowledgement } from './weapon/WeaponAcknowledgement';
import { installPlayerMessageGuards } from './ship/PlayerMessageGuards';
import { installWarpAnnouncement } from './chat/WarpAnnouncement';
import { installPlayerIOUnicode } from './network/PlayerIOUnicode';
import { installBodyMissionHints } from './world/BodyMissionHints';
import { installBodyVisuals } from './world/BodyVisuals';
import { installBodyIndexes } from './world/BodyIndexes';
import { installBodySpawners } from './world/BodySpawners';
import { installSpawnerIndexes } from './world/SpawnerIndexes';
import { installInstantCulling } from './projectile/InstantCulling';
import { installProjectileRanges } from './projectile/ProjectileRanges';
import { installPlayerProjectilePackets } from './projectile/PlayerProjectilePackets';
import { installWeaponSelectorTooltips } from './weapon/WeaponSelectorTooltips';
import { installMenuSlotBackground } from './ship/MenuSlotBackground';
import { installNativeDiscordPresence } from './discord/NativeDiscordPresence';
import { installNativeWeaponDraw } from './weapon/NativeWeaponDraw';
import { installNativeTurretUpdates } from './turret/NativeTurretUpdates';
import { installNativePodRequests } from './pods/NativePodRequests';
import { installTechBarDisposal } from './tech/TechBarDisposal';
import { installNativeResourceUpgrades } from './tech/NativeResourceUpgrades';
import { installNativeClanLogos } from './ui/NativeClanLogos';
import { installShipSelectionText } from './login/ShipSelectionText';
import { installShopText } from './ui/ShopText';
import { installTechPresentation } from './tech/TechPresentation';
import { installTechIconDisposal } from './tech/TechIconDisposal';
import { installQueueActions } from './pvp/QueueActions';
import { installNativeRosterRetry } from './pvp/NativeRosterRetry';
import { installChargeParticles } from './weapon/ChargeParticles';
import { installWeaponChargeOwnership } from './weapon/WeaponChargeOwnership';
import { installDamageDescription } from './weapon/DamageDescription';
import { installWeaponDescription } from './weapon/WeaponDescription';
import { installWeaponTechStats } from './weapon/WeaponTechStats';
import { installWeaponFireOwnership } from './weapon/WeaponFireOwnership';
import { installWeaponLifecycle } from './weapon/WeaponLifecycle';
import { installNativeTooltip } from './ui/NativeTooltip';
import { installParallaxCleanup } from './rendering/ParallaxCleanup';
import { installParallaxLoading } from './rendering/ParallaxLoading';
import { installTextureBatches } from './rendering/TextureBatches';
import { installTextureFrames } from './rendering/TextureFrames';
import { installServiceReconnect } from './service/ServiceReconnect';
import { installServiceViews } from './service/ServiceViews';
import { installGameRecovery } from './service/GameRecovery';
import { installServiceRecovery } from './service/ServiceRecovery';
import { installInitialWorld } from './rendering/InitialWorld';
import { installWarpAnimation } from './rendering/WarpAnimation';
import { installWarpTransition } from './login/WarpTransition';
import { installPreparedWarp } from './login/PreparedWarp';
import { installInitialGameConnection } from './network/InitialGameConnection';
import { installClockLifecycle } from './clock/ClockLifecycle';
import { installRoomRefresh } from './login/RoomRefresh';
import { installGameRoomJoin } from './login/GameRoomJoin';
import { installSceneOwnership } from './login/SceneOwnership';
import { installRoomTransition } from './login/RoomTransition';
import { installDailyMissionLocalization } from './missions/DailyMissionLocalization';
import { installRoamingInput } from './movement/RoamingInput';
import { installLandedInput } from './movement/LandedInput';
import { installLandedExploreInput } from './movement/LandedExploreInput';
import { installClanMemberCopy } from './clan/ClanMemberCopy';
import { installExplorationPresentation } from './explore/Presentation';
import { installExploreMapBoundary } from './explore/MapBoundary';
import { installExploreMapGeneration } from './explore/MapGeneration';
import { installExplorationRewards } from './artifacts/ExplorationRewards';
import { installDeathPresentation } from './runtime/DeathPresentation';
import { installMissionPresentation } from './missions/MissionPresentation';
import { installMissionDescription } from './missions/MissionDescription';
import { installMissionRead } from './missions/MissionRead';
import { installScreenText } from './ui/ScreenText';
import { installLoadingCover } from './login/LoadingCover';
import { GameReflection } from './api/GameReflection';
import { installGameMessageHandlers } from './network/GameMessageHandlers';
import { installSceneMessages } from './network/SceneMessages';
import { installConnectionNotices } from './network/ConnectionNotices';
import { installGameDisconnect } from './network/GameDisconnect';
import { installServiceDisconnect } from './network/ServiceDisconnect';
import { installServiceMessageHandlers } from './network/ServiceMessageHandlers';
import { installSceneRPC } from './network/SceneRPC';
import { installClockResponseSamples } from './clock/ClockResponseSamples';
import { installNativeClockTiming } from './clock/NativeClockTiming';
import { installNativeClockWatchdog } from './clock/NativeClockWatchdog';
import { installNativeConnectionHealth } from './network/NativeConnectionHealth';
import { installNativeDailyRewards } from './ui/NativeDailyRewards';
import { installNativeErrorDiagnostics } from './diagnostics/NativeErrorDiagnostics';
import { ClientErrorDiagnostics } from './diagnostics/ClientErrorDiagnostics';
import { createBitmapClasses } from './ui/BitmapClasses';
import { installArtifactMenu } from './artifacts/ArtifactMenu';
import { installExpandedArtifactOverview } from './artifacts/ExpandedArtifactOverview';
import { installArtifactPurify } from './artifacts/ArtifactPurify';
import { installArtifactRecycleLayout } from './artifacts/ArtifactRecycleLayout';
import { createArtifactSorting } from './artifacts/ArtifactSorting';
import { loginControl } from './login/LoginControl';
import { installNativeArtifactFavorites } from './artifacts/NativeArtifactFavorites';
import { installArtifactCargo } from './artifacts/ArtifactCargo';
import { installArtifactSetupSelection } from './artifacts/ArtifactSetupSelection';
import { setupScrollbarSkin } from './artifacts/SetupScrollbarSkin';
import aeonImage from './assets/theme/Aeon.png';
import { portedClasses } from './ported/Registry';
import { installNativeRewardNotices } from './chat/NativeRewardNotices';
import { installNativeIPCAuthentication } from './ipc/NativeIPCAuthentication';
import { installMusicService } from './music/NativeMusicPlayer';
import type { MusicPlayerService } from './music/MusicPlayer';
import { installMapDisposal } from './map/MapDisposal';
import { installMapDeathLineLifecycle } from './map/MapDeathLineLifecycle';
import { installMapPlayerLifecycle } from './map/MapPlayerLifecycle';
import { installDisplayTexturePixels } from './ui/DisplayTexturePixels';
import { installCombatTextFrames } from './rendering/CombatTextFrames';
import { installEmitterFrames } from './rendering/EmitterFrames';
import { installLocalClientCommands } from './chat/LocalClientCommands';
import { installNativeDeathMessages } from './chat/NativeDeathMessages';
import { installNativeController } from './controller/NativeController';
import { installWeaponInput } from './weapon/WeaponInput';
import { installPaintShop } from './ship/PaintShop';
import { installShipCreation } from './ship/ShipCreation';
import { installRangeIndex } from './data/RangeIndex';
import { installLocalization } from './data/Localization';
import { installShipWarpLifecycle } from './ship/ShipWarpLifecycle';
import { installTeleportDestination } from './ship/TeleportDestination';
import { installReconstructionEffects } from './ship/ReconstructionEffects';
import { installEnemyLifecycle } from './ship/EnemyLifecycle';
import { installEnemyObservations } from './ship/EnemyObservations';
import { installBossSpawnTimerHooks } from './boss/NativeBossSpawnTimers';
import { installBossSpawnNotices } from './boss/BossSpawnNotices';
import { installCreditRefresh } from './network/CreditRefresh';
import { installArtifactPrompts } from './artifacts/ArtifactPrompts';
import { installMapTextureKeys } from './map/MapTextureKeys';
import { installNetherBlobBeamHooks } from './ship/NetherBlobBeamCountdown';
import { installTorpedoDebugHooks } from './projectile/NativeTorpedoDebug';
import { installTorpedoTimingHooks } from './projectile/NativeTorpedoTiming';
import { installTorpedoCueHooks } from './projectile/XhersixTorpedoCue';
import { installNativeAutomations } from './automation/NativeAutomations';
import targetIcon from './assets/images/TargetIcon.png';
import { type API } from './api/Types';
import { installGameSession } from './runtime/GameSession';
import { installServicePreviewLifecycle } from './service/ServicePreviewLifecycle';
import { installServiceRoomSelection } from './service/ServiceRoomSelection';
import { installSessionProtection } from './runtime/SessionProtection';
import { installNativeBitmapText } from './ui/NativeBitmapText';
import { loadFonts } from './ui/Fonts';
import { loginIdentity, CLIENT_VERSION_LABEL, CLIENT_BUILD } from './login/LoginIdentity';
import { loginProfiles } from './login/LoginProfiles';
import { prepareLoginPresentation } from './login/LoginPresentation';
import { installLoginProfileNames } from './login/LoginProfileNames';
import { installLoginLoading } from './login/LoginLoading';
import {
  bindGameClasses,
  Login,
  Starling,
  DisplayObjectContainer,
  type DisplayObject,
} from './game/Bindings';
import { installArtifactUI } from './artifacts/NativeArtifacts';
import { installInterpolation } from './rendering/Interpolation';
import { installLandedFrameRate } from './rendering/LandedFrameRate';
import { installFrameRate } from './rendering/FrameRate';
import { installDisplayScale } from './rendering/DisplayScale';
import { installCompactStarMap } from './map/CompactStarMap';
import { DeviceSettings } from './settings/DeviceSettings';
import { installBackgroundLayers } from './rendering/BackgroundLayers';

export default {
  id: 'qolaf.client',
  name: 'QoLAF Client',
  description: `${CLIENT_BUILD} build · Gameplay, chat, interface and rendering improvements.`,
  safeToHotReload: true,
  version: CLIENT_VERSION_LABEL,
  apiVersion: 1,
  activate(api: API) {
    installNativeErrorDiagnostics(api);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
      api.defer(loginControl.observe(window));
    let music: MusicPlayerService | undefined;
    if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
      installNativeAutomations(api);
    const deviceSettings = new DeviceSettings(api.storage);
    api.defer(() => deviceSettings.flush());
    let classesInitialized = false;
    let fonts: Promise<void> | undefined;
    const ensureFonts = () =>
      (fonts ??= loadFonts(api).then(() => {
        // This bridge targets the OpenFL-backed Haxe Text ABI. Starling's own
        // TextField has a different constructor and must never be patched here.
        if (typeof api.cls('core.hud.components.Text')?.prototype.set_htmlText === 'function') {
          installNativeBitmapText(api);
        }
      }));
    api.on('classesReady', () => {
      installPlayerIOUnicode(api);
      classesInitialized = false;
      bindGameClasses(api);
      installWeaponLifecycle(api);
      installSpawnerIndexes(api);
      installBodyMissionHints(api);
      installBodyVisuals(api);
      installBodySpawners(api);
      installBodyIndexes(api);
      installPlayerProjectilePackets(api);
      installProjectileRanges(api);
      installInstantCulling(api);
      installWeaponFireOwnership(api);
      installWeaponChargeOwnership(api);
      installChargeParticles(api);
      installWeaponTechStats(api);
      installWeaponDescription(api);
      installDamageDescription(api);
      installWeaponSelectorTooltips(api);
      installMenuSlotBackground(api);
      installNativeWeaponDraw(api);
      installNativeTurretUpdates(api);
      installNativeRosterRetry(api);
      installQueueActions(api);
      installNativeClanLogos(api);
      installWeaponAcknowledgement(api);
      installPlayerMessageGuards(api);
      installWarpAnnouncement(api);
      installTechBarDisposal(api);
      installTechIconDisposal(api);
      installTechPresentation(api);
      installShopText(api);
      installShipSelectionText(api);
      installNativeResourceUpgrades(api);
      installClockLifecycle(api);
      installClockResponseSamples(api);
      installNativeClockTiming(api);
      const resetClockObservation = installNativeClockWatchdog(api);
      installInitialGameConnection(api);
      installConnectionNotices(api);
      installSceneMessages(api);
      installSceneRPC(api);
      installMissionRead(api);
      installMissionDescription(api);
      installMissionPresentation(api);
      installDeathPresentation(api);
      installExplorationRewards(api);
      installExplorationPresentation(api);
      installExploreMapBoundary(api);
      installExploreMapGeneration(api);
      installClanMemberCopy(api);
      installLandedInput(api);
      installRoamingInput(api);
      installLandedExploreInput(api);
      installDailyMissionLocalization(api);
      installServiceMessageHandlers(api);
      installGameMessageHandlers(api);
      installServiceDisconnect(api);
      installGameDisconnect(api);
      installLoginProfileNames(api);
      installLoginLoading(api);
      installTextureBatches(api);
      installTextureFrames(api);
      installScreenText(api);
      installLoadingCover(api);
      installParallaxCleanup(api);
      installParallaxLoading(api);
      installInitialWorld(api);
      installWarpTransition(api, resetClockObservation);
      installSceneOwnership(api);
      installRoomTransition(api);
      installPreparedWarp(api);
      installWarpAnimation(api);
      installGameRoomJoin(api);
      installRoomRefresh(api);
      installServiceReconnect(api);
      installNativeIPCAuthentication(api);
      installServiceViews(api);
      installServiceRecovery(api);
      installGameRecovery(api);
      installNativeDiscordPresence(api);
      installNativePodRequests(api);
      installNativeRewardNotices(api);
      installNativeDailyRewards(api);
      music = installMusicService(api);
      installLocalClientCommands(api);
      installNativeDeathMessages(api);
      installWeaponInput(api);
      installNativeController(api);
      installRewardRates(api);
      installPaintShop(api);
      installShipCreation(api);
      installRangeIndex(api);
      installServiceRoomSelection(api);
      installServicePreviewLifecycle(api);
      installLocalization(api);
      installShipWarpLifecycle(api);
      installTeleportDestination(api);
      installReconstructionEffects(api);
      installEnemyObservations(api);
      installEnemyLifecycle(api);
      installBossSpawnTimerHooks(api);
      installBossSpawnNotices(api);
      installCreditRefresh(api);
      installTorpedoCueHooks(api);
      installTorpedoTimingHooks(api);
      installTorpedoDebugHooks(api);
      installDisplayTexturePixels(api);
      installNativeTooltip(api);
      installArtifactPrompts(api);
      installMapTextureKeys(api);
      installMapPlayerLifecycle(api);
      installMapDeathLineLifecycle(api);
      installMapDisposal(api);
      installNetherBlobBeamHooks(api);
      installInterpolation(api);
      installEmitterFrames(api);
      installCombatTextFrames(api);
      installDisplayScale(api, deviceSettings);
      installFrameRate(api, deviceSettings);
      installLandedFrameRate(api);
      const login: Login & { $qolafAllowSteam?: boolean } = Login.prototype;
      const reflection = new GameReflection(api);
      reflection.around(login, 'connectSteam', function (next, ...args) {
        if (this.$qolafAllowSteam) return next(...args);
      });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('qolaf:login-supported'));
      let loginPresentationActive = true;
      const presentedLogins = new WeakSet<Login>();
      api.defer(() => {
        loginPresentationActive = false;
      });
      const presentLogin = (instance: Login) => {
        if (presentedLogins.has(instance)) return;
        presentedLogins.add(instance);
        api.defer(
          prepareLoginPresentation(
            instance,
            ensureFonts(),
            () => {
              if (!loginPresentationActive) return;
              api.defer(loginIdentity(instance));
              api.defer(loginProfiles(api, instance));
            },
            (error) => {
              ClientErrorDiagnostics.record(error, 'Login font initialization');
              api.log('Login font initialization failed', error);
            },
          ),
        );
      };
      reflection.after(login, 'init', function () {
        presentLogin(this);
      });
      // Unsafe enabling does not rerun Login.init: attach to the existing screen.
      const visitLogin = (node: DisplayObject): void => {
        if (node instanceof Login) {
          presentLogin(node);
          return;
        }
        if (node instanceof DisplayObjectContainer)
          for (let index = 0; index < node.get_numChildren(); index++)
            visitLogin(node.getChildAt(index));
      };
      const existingStage = Starling.get_current()?.get_stage();
      if (existingStage) visitLogin(existingStage);
      installArtifactMenu(api);
      installExpandedArtifactOverview(api, createBitmapClasses(portedClasses(api).resolve).resolve);
      installArtifactUI(api, () => createArtifactSorting(portedClasses(api).resolve));
      const artifactFavorites = installNativeArtifactFavorites(api);
      installArtifactPurify(api, artifactFavorites);
      installArtifactRecycleLayout(api);
      installArtifactSetupSelection(api, setupScrollbarSkin(api, aeonImage));
      installArtifactCargo(api, () =>
        portedClasses(api).resolve('feathers.controls.ScrollContainer'),
      );
      installCompactStarMap(api);
      classesInitialized = true;
    });
    api.onGame((game, session) => {
      // A failed global installation is already reported by the host. Do not
      // attach a partially initialized HUD or start its async font/session work.
      if (!classesInitialized) return;
      const scene = new GameReflection(session).cast(game, 'core.scene.Game');
      const runtimeSettings = installSessionProtection(session, scene);
      installNativeConnectionHealth(session, scene);
      installBackgroundLayers(scene, session, deviceSettings);
      let alive = true;
      session.defer(() => {
        alive = false;
      });
      void ensureFonts()
        .then(() => {
          if (!alive) return;
          installGameSession(scene, session, runtimeSettings, deviceSettings, targetIcon, music);
        })
        .catch((error) => {
          ClientErrorDiagnostics.record(error, 'Native client initialization');
          session.log('Native client initialization failed', error);
        });
    });
  },
};
