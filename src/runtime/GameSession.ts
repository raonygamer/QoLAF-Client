import { installPowerNumber } from '../hud/PowerNumber';
import { installCargoCompression } from '../cargo/CargoCompression';
import { installPlayerListLifecycle } from '../hud/PlayerListLifecycle';
import { installBossVisibility } from '../hud/BossVisibility';
import { installPlayerListRoles } from '../hud/PlayerListRoles';
import { installGameplayPointer } from './GameplayPointer';
import { installNativeNoticeLayout } from '../hud/NativeNoticeLayout';
import { installNativeChatOverlays } from '../chat/NativeChatOverlays';
import { installNativeAbilityCooldown } from '../hud/NativeAbilityCooldown';
import { restoreChatInputOnUnload } from '../chat/ChatInputRestore';
import { installNativeWorldZoom } from '../movement/NativeWorldZoom';
import { installNativeChatValidation } from '../chat/NativeChatValidation';
import { installChatSpeedTest } from '../chat/ChatSpeedTest';
import { installChatArtifactHint } from '../chat/ChatArtifactHint';
import { GameReflection } from '../api/GameReflection';
import { installNativeBombShockwaves } from '../rendering/NativeBombShockwaves';
import { installClientLoginNotices } from '../chat/ClientLoginNotices';
import { installNativeEmperorCoordination } from '../ipc/NativeEmperorCoordination';
import { installFloatingChatSendSlot } from '../chat/FloatingChatSendSlot';
import { installNativeFloatingChat } from '../chat/NativeFloatingChat';
import { installNativeIncomingHistory } from '../telemetry/NativeIncomingHistory';
import { installNativeControlTiming } from '../movement/NativeControlTiming';
import { installNativeSelfMovement } from '../movement/NativeSelfMovement';
import { installNativeQolafChat } from '../chat/NativeQolafChat';
import { installNativeRoomControl } from '../chat/NativeRoomControl';
import { installNativeWeaponColorPopup } from '../visuals/NativeWeaponColorPopup';
import { installNativeBeamGeometry } from '../weapon/NativeBeamGeometry';
import { installNativeClientDevVisual } from '../visuals/NativeClientDevVisual';
import { installNativeShipVisualScale } from '../visuals/NativeShipVisualScale';
import { installNativeShipVisuals } from '../visuals/NativeShipVisuals';
import { installNativeVisualShare } from '../ipc/NativeVisualShare';
import { installNativeShipPreviews } from '../visuals/NativeShipPreviews';
import { installNativeProfiler } from '../network/NativeProfiler';
import { installNativePacketDebug } from '../network/NativePacketDebug';
import { installNativeNetworkMonitor } from '../network/NativeNetworkMonitor';
import { installNativeDisposeDebug } from '../network/NativeDisposeDebug';
import { installNativeMusicPlayer } from '../music/NativeMusicPlayer';
import type { MusicPlayerService } from '../music/MusicPlayer';
import { installNativePlayerInspect } from '../inspect/NativePlayerInspect';
import { installNativeClientHelp } from '../dialogs/NativeClientHelp';
import { installNativeClientChangelog } from '../dialogs/NativeClientChangelog';
import pingSoundURL from '../assets/sounds/Ping.mp3';
import { ChatPingSound } from '../chat/ChatPingSound';
import { installNativeChatPingPreview } from '../chat/NativeChatPingPreview';
import { installNativeChatPresentation } from '../chat/NativeChatPresentation';
import { installNativeAimAssist } from '../aim/NativeAimAssist';
import { installTargetPicking } from '../target/TargetPicking';
import { installNativeChatImageViewer } from '../chat/NativeChatImageViewer';
import { ChatImageCache } from '../chat/ChatImageCache';
import { ChatRemoteImageLoader } from '../chat/ChatRemoteImageLoader';
import { createBrowserImagePlatform } from '../chat/BrowserImagePlatform';
import { installNativeChatTab } from '../chat/NativeChatTab';
import { installNativeChatHistory } from '../chat/NativeChatHistory';
import {
  installNativeChatArtifactPolicy,
  installArtifactDraftChannels,
} from '../chat/NativeChatArtifactPolicy';
import { installNativeSimpleChat } from '../chat/NativeSimpleChat';
import { installNativeAdvancedChat } from '../chat/NativeAdvancedChat';
import { installNativeChatLayout } from '../chat/NativeChatLayout';
import { installNativeChatMessages } from '../chat/NativeChatMessages';
import { installChatArtifactHistory } from '../chat/ChatArtifactHistory';
import { installNativeChatTheme } from '../chat/NativeChatTheme';
import { installNativeChatContext } from '../chat/NativeChatContext';
import { installNativeRichChatInput } from '../chat/NativeRichChatInput';
import { installNativeChatFormatting } from '../chat/NativeChatFormatting';
import { portedClasses } from '../ported/Registry';
import { createBitmapClasses } from '../ui/BitmapClasses';
import { installCommandAutocomplete } from '../chat/ChatCommandAutocompletePopup';
import { installNativeArtifactDraft } from '../chat/NativeArtifactDraft';
import { installNexarWorldLabels } from '../ship/NexarWorldLabel';
import { installRadarMiniatures } from '../radar/RadarMiniatures';
import { installMapLiveMiniatures } from '../map/NativeMapLiveMiniatures';
import { installMapNavigation } from '../map/NativeMapNavigation';
import { installBossSpawnMarkers } from '../map/BossSpawnMarkerManager';
import { installNetherBlobBeamCountdown } from '../ship/NetherBlobBeamCountdown';
import { installTorpedoWarnings } from '../projectile/XhersixTorpedoWarningBatch';
import { installTorpedoCue } from '../projectile/XhersixTorpedoCue';
import { installDamageObserver } from '../telemetry/DamageObserver';
import { Artifact, Localize, type GameScene } from '../game/Bindings';
import type { API } from '../api/Types';
import type { sessionSettings } from '../settings/RuntimeSettings';
import { installNativeSettings } from '../settings/NativeSettings';
import type { DeviceSettings } from '../settings/DeviceSettings';
import type { Settings } from '../settings/Settings';
import { installDebuffTracker } from '../debuff/DebuffTracker';
import { TargetSystem } from '../target/TargetSystem';
import { NativeUI } from '../ui/NativeUI';
import { loadTargetAimIndicator, type TargetAimIndicator } from '../ui/TargetAimIndicator';
import { TargetInfo } from '../ui/TargetInfo';
import { installHealthAndShield } from '../hud/HealthAndShield';
import { installNativeChatPreferences } from '../chat/NativeChatPreferences';
import { installNativeChatRolePreview } from '../chat/NativeChatRolePreview';
import { ChatArtifactLinkResolver } from '../chat/ChatArtifactLinkResolver';
import { installNativeChatArtifactPreview } from '../chat/NativeChatArtifactPreview';
import { installClanLabels } from '../ui/ClanLabel';
import { installDamageText } from '../hud/DamageText';
import { installRespawn } from './Respawn';
import { installPortableScreens } from './PortableScreens';
import { RadarTelemetry } from '../ui/RadarTelemetry';

/** Owns the native HUD nodes and hooks for one connected game session. */
export function installGameSession(
  game: GameScene & { targetSystem?: TargetSystem },
  session: API,
  runtimeSettings: ReturnType<typeof sessionSettings>,
  preferences?: DeviceSettings,
  targetIcon?: string,
  music?: MusicPlayerService,
): void {
  restoreChatInputOnUnload(session, game);
  const reflection = new GameReflection(session);
  const hud = game.hud;
  if (!hud) throw new Error('Game session requires an initialized native HUD');
  const ui = new NativeUI(session);
  const { client, config, save } = runtimeSettings;
  // Nameplates must not depend on later optional screen/visual initializers.
  installClanLabels(session, game);
  installNativeChatValidation(session, game);
  installPortableScreens(session, game);
  installNativeBombShockwaves(session, game);
  installFloatingChatSendSlot(session, game);
  if (music) installNativeMusicPlayer(session, game, music);
  installTorpedoCue(session, game);
  installTorpedoWarnings(session, game);
  installNetherBlobBeamCountdown(session, game);
  installMapNavigation(session, game);
  installBossSpawnMarkers(session, game);
  installMapLiveMiniatures(session, game);
  installRadarMiniatures(session, game);
  installNexarWorldLabels(session, game);
  installNativeSettings(session, preferences);
  installNativeWorldZoom(session, game, preferences);
  installNativeClientDevVisual(session, game);
  installNativeShipVisualScale(session, game);
  installNativeWeaponColorPopup(session, game);
  installNativeShipVisuals(session, game);
  installNativeVisualShare(session, game);
  installNativeShipPreviews(session, game);
  installNativeIncomingHistory(session, game);
  installNativeSelfMovement(session, game);
  installNativeProfiler(session, game);
  installChatSpeedTest(session, game);
  installNativePacketDebug(session, game);
  installNativeNetworkMonitor(session, game);
  installNativeDisposeDebug(session, game);
  installNativeBeamGeometry(session, game);
  installHealthAndShield(session, game);
  installRespawn(session, game, preferences);
  installDamageText(session, game);
  installNativeChatPreferences(session, game, preferences);
  const bitmap = createBitmapClasses(portedClasses(session).resolve);
  installPlayerListRoles(session, game, bitmap.resolve);
  const images = new ChatImageCache(() => new ChatRemoteImageLoader(createBrowserImagePlatform()));
  session.defer(() => images.dispose());
  const artifacts = new ChatArtifactLinkResolver(
    game,
    (record) => new Artifact(record),
    (text) => Localize.t(text),
  );
  session.defer(() => artifacts.dispose());
  installChatArtifactHistory(session, game, artifacts);
  const messages = installNativeChatMessages(
    session,
    game,
    bitmap.resolve,
    preferences,
    images,
    artifacts,
  );
  installPowerNumber(session, game);
  installCargoCompression(session, game);
  installNativeAdvancedChat(session, game);
  const waitingForRelease = installNativeClientChangelog(session, game);
  installNativeClientHelp(session, game, waitingForRelease);
  if (messages) installNativeChatImageViewer(session, game, bitmap.resolve, images, messages);
  if (messages) installNativeChatRolePreview(session, game, bitmap.resolve, messages);
  if (messages)
    installNativeChatArtifactPreview(session, game, bitmap.resolve, messages, artifacts);
  if (messages) installNativeChatPingPreview(session, game, bitmap.resolve, messages);
  const pingSound = new ChatPingSound(pingSoundURL);
  session.defer(() => pingSound.dispose());
  installNativeEmperorCoordination(session, game, () => pingSound.play());
  installClientLoginNotices(session, game);
  installNativeChatPresentation(session, game, () => pingSound.play());
  installChatArtifactHint(session, game);
  installNativeQolafChat(session, game);
  installNativeRoomControl(session, game);
  installNativeChatContext(session, game, bitmap.resolve);
  // Reject forbidden artifact tabs before the rich input applies Global restrictions.
  installArtifactDraftChannels(session, game);
  const editor = installNativeRichChatInput(session, game, bitmap.resolve, preferences, artifacts);
  installNativeChatArtifactPolicy(session, game);
  if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
    installNativePlayerInspect(session, game);
  installNativeSimpleChat(
    session,
    game,
    messages
      ? { resolve: bitmap.resolve, cache: images, renderer: messages.simpleRenderer }
      : undefined,
  );
  installNativeChatLayout(session, game, preferences);
  installNativeChatTheme(session, game, preferences);
  const formatting = editor
    ? installNativeChatFormatting(session, game, editor, bitmap.resolve, preferences, images)
    : undefined;
  const autocomplete = installCommandAutocomplete(
    session,
    game,
    () => formatting?.isOpen ?? false,
    editor ? { editor, resolve: bitmap.resolve, preferences } : undefined,
  );
  installNativeArtifactDraft(session, game, editor, artifacts, () => autocomplete?.close());
  // Autocomplete must wrap the history replacement to suppress refreshes
  // while navigation synchronously updates the editor and selection.
  installNativeChatHistory(session, game);
  installNativeChatTab(session, game, preferences);
  installNativeChatOverlays(session, game);
  installPlayerListLifecycle(session, game);
  installNativeAbilityCooldown(session, game);
  installNativeNoticeLayout(session, game);
  const targetReflection = reflection;
  const target = new TargetSystem(game, config);
  target.initializeEvents();
  const previousTargetSystem = Object.getOwnPropertyDescriptor(game, 'targetSystem');
  Object.defineProperty(game, 'targetSystem', {
    configurable: true,
    writable: true,
    value: target,
  });
  session.defer(() => {
    target.disposeEvents();
    if (game.targetSystem !== target) return;
    if (previousTargetSystem) Object.defineProperty(game, 'targetSystem', previousTargetSystem);
    else delete game.targetSystem;
  });
  installNativeFloatingChat(session, game, bitmap.resolve, images, preferences);
  let indicator: TargetAimIndicator | undefined;
  if (targetIcon)
    loadTargetAimIndicator(session, game, target, targetIcon, (value) => {
      indicator = value;
    });
  const debuffs = installDebuffTracker(session, game);
  const panel = new TargetInfo(ui, game, target, config, save, debuffs);
  session.defer(() => panel.dispose());
  const damage = installDamageObserver(session, game, config, (unit) =>
    target.auto(targetReflection.cast(unit, 'core.unit.Unit')),
  );
  installNativeAimAssist(session, game, client, target, damage);
  installNativeControlTiming(session, game);
  const telemetry = new RadarTelemetry(ui, game, config, damage);
  session.defer(() => telemetry.dispose());

  // The original HUD owns these nodes, so opening menus hides them too.
  hud.container.addChild(panel.node);
  hud.container.addChild(telemetry.node);

  installGameplayPointer(session, game);
  installTargetPicking(game, session, target);
  const updateBossVisibility = installBossVisibility(game, session, config);

  session.on('frame', ({ game: currentGame, event }) => {
    if (currentGame !== game) return;

    const elapsedSeconds = event.get_passedTime();
    target.update(elapsedSeconds);
    indicator?.update(elapsedSeconds, client.disableSelectedTargetIcon);
    panel.update(elapsedSeconds);
    telemetry.update(elapsedSeconds);
    updateBossVisibility();
  });

  // Original Weapon.registerSimulatedHit is the automatic selection trigger.
  // Merely appearing on the radar must not replace the current target.
}
