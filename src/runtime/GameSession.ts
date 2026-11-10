import pingSoundUrl from '../assets/sounds/Ping.mp3';
import { ChatPingSound } from '../chat/ChatPingSound';
import { installNativeChatPingPreview } from '../chat/NativeChatPingPreview';
import { installNativeFriendPings } from '../chat/NativeFriendPings';
import { installNativeAimAssist } from '../aim/NativeAimAssist';
import { installTargetPicking } from '../target/TargetPicking';
import { installNativeChatImageViewer } from '../chat/NativeChatImageViewer';
import { ChatImageCache } from '../chat/ChatImageCache';
import { ChatRemoteImageLoader } from '../chat/ChatRemoteImageLoader';
import { createBrowserImagePlatform } from '../chat/BrowserImagePlatform';
import { installNativeChatHistory } from '../chat/NativeChatHistory';
import { installNativeChatArtifactPolicy } from '../chat/NativeChatArtifactPolicy';
import { installNativeSimpleChat } from '../chat/NativeSimpleChat';
import { installNativeChatLayout } from '../chat/NativeChatLayout';
import { installNativeChatMessages } from '../chat/NativeChatMessages';
import { installNativeChatTheme } from '../chat/NativeChatTheme';
import { installNativeChatContext } from '../chat/NativeChatContext';
import { installNativeRichChatInput } from '../chat/NativeRichChatInput';
import { installNativeChatFormatting } from '../chat/NativeChatFormatting';
import { portedClasses } from '../ported/Registry';
import { createBitmapClasses } from '../ui/BitmapClasses';
import { installCommandAutocomplete } from '../chat/ChatCommandAutocompletePopup';
import { installNexarWorldLabels } from '../ship/NexarWorldLabel';
import { installMapLiveMiniatures } from '../map/NativeMapLiveMiniatures';
import { installMapNavigation } from '../map/NativeMapNavigation';
import { installBossSpawnMarkers } from '../map/BossSpawnMarkerManager';
import { installNetherBlobBeamCountdown } from '../ship/NetherBlobBeamCountdown';
import { installTorpedoWarnings } from '../projectile/XhersixTorpedoWarningBatch';
import { installTorpedoCue } from '../projectile/XhersixTorpedoCue';
import { installInactivityPreference } from './Inactivity';
import { installDamageObserver } from '../telemetry/DamageObserver';
import { read, type API, type Raw } from '../api/Types';
import { sessionSettings } from '../settings/RuntimeSettings';
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
import { RadarTelemetry } from '../ui/RadarTelemetry';

/** Owns the native HUD nodes and hooks for one connected game session. */
export function installGameSession(
  game: Raw,
  session: API,
  preferences?: DeviceSettings,
  targetIcon?: string,
): void {
  const ui = new NativeUI(session);
  const { client, config, save } = sessionSettings(session, game);
  installInactivityPreference(session, game);
  installTorpedoCue(session, game);
  installTorpedoWarnings(session, game);
  installNetherBlobBeamCountdown(session, game);
  installMapNavigation(session, game);
  installBossSpawnMarkers(session, game);
  installMapLiveMiniatures(session, game);
  installNexarWorldLabels(session, game);
  installNativeSettings(session, preferences);
  installHealthAndShield(session, game);
  installRespawn(session, game);
  installDamageText(session, game);
  installClanLabels(session, game);
  installNativeChatPreferences(session, game, preferences);
  const bitmap = createBitmapClasses(portedClasses(session).resolve);
  const images = new ChatImageCache(
    () => new ChatRemoteImageLoader(createBrowserImagePlatform(bitmap.resolve)),
  );
  session.defer(() => images.dispose());
  const Artifact = session.cls('core.artifact.Artifact') as any;
  const artifacts = new ChatArtifactLinkResolver(
    game,
    (record) => new Artifact(record),
    (text) => session.cls('generics.Localize')!.t(text),
  );
  session.defer(() => artifacts.dispose());
  const messages = installNativeChatMessages(
    session,
    game,
    bitmap.resolve,
    preferences,
    images,
    artifacts,
  );
  if (messages) installNativeChatImageViewer(session, game, bitmap.resolve, images, messages);
  if (messages) installNativeChatRolePreview(session, game, bitmap.resolve, messages);
  if (messages)
    installNativeChatArtifactPreview(session, game, bitmap.resolve, messages, artifacts);
  if (messages) installNativeChatPingPreview(session, game, bitmap.resolve, messages);
  const pingSound = new ChatPingSound(session, pingSoundUrl);
  session.defer(() => pingSound.dispose());
  installNativeFriendPings(session, game, () => pingSound.play());
  installNativeChatContext(session, game, bitmap.resolve);
  const editor = installNativeRichChatInput(session, game, bitmap.resolve, preferences);
  installNativeChatArtifactPolicy(session, game);
  installNativeChatHistory(session, game);
  installNativeSimpleChat(
    session,
    game,
    messages
      ? { resolve: bitmap.resolve, cache: images, renderer: messages.simpleRenderer }
      : undefined,
  );
  installNativeChatLayout(session, game, preferences);
  installNativeChatTheme(session, game, bitmap.resolve, preferences);
  const formatting = editor
    ? installNativeChatFormatting(session, game, editor, bitmap.resolve, preferences, images)
    : undefined;
  installCommandAutocomplete(
    session,
    game,
    () => formatting?.isOpen ?? false,
    editor ? { editor, resolve: bitmap.resolve, preferences } : undefined,
  );
  const target = new TargetSystem(game, config, session.cls('core.ship.PlayerShip'));
  let indicator: TargetAimIndicator | undefined;
  if (targetIcon)
    loadTargetAimIndicator(ui, game, target, targetIcon, (value) => {
      indicator = value;
    });
  const debuffs = installDebuffTracker(session, game);
  const panel = new TargetInfo(ui, game, target, config, save, debuffs);
  session.defer(() => panel.dispose());
  const damage = installDamageObserver(session, game, config, (unit) => target.auto(unit));
  installNativeAimAssist(session, game, client, target, damage);
  const telemetry = new RadarTelemetry(ui, game, config, damage);
  session.defer(() => telemetry.dispose());

  // The original HUD owns these nodes, so opening menus hides them too.
  game.hud.container.addChild(panel.node);
  game.hud.container.addChild(telemetry.node);

  installTargetPicking(game, session, ui, target);
  const updateBossVisibility = installBossVisibility(game, session, config);

  session.on('frame', ({ game: currentGame, event }) => {
    if (currentGame !== game) return;

    const elapsedSeconds = read(event, 'passedTime', 0);
    target.update(elapsedSeconds);
    indicator?.update(
      elapsedSeconds,
      !!session.cls('core.scene.SceneBase')?.clientSettings?.disableSelectedTargetIcon,
    );
    panel.update(elapsedSeconds);
    telemetry.update(elapsedSeconds);
    updateBossVisibility();
  });

  // Original Weapon.registerSimulatedHit is the automatic selection trigger.
  // Merely appearing on the radar must not replace the current target.
}

function installBossVisibility(game: Raw, session: API, config: Settings): () => void {
  const bossBar = game.hud.bossHealth;
  const setVisibility = bossBar?.set_visible;
  let nativeVisibility = read(bossBar, 'visible');

  // Remember what the game wants, even while the client hides its boss bar.
  // Disabling the override restores that value rather than forcing it visible.
  session.defer(() => setVisibility?.call(bossBar, nativeVisibility));
  if (setVisibility) {
    session.around(bossBar, 'set_visible', function (next, value) {
      nativeVisibility = value;
      return next(config.disable_native_boss_bar ? false : value);
    });
  }

  return () => {
    setVisibility?.call(bossBar, config.disable_native_boss_bar ? false : nativeVisibility);
  };
}
