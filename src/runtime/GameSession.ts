import { installNativeChatHistory } from '../chat/NativeChatHistory';
import { installNativeRichChatInput } from '../chat/NativeRichChatInput';
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
  const { config, save } = sessionSettings(session, game);
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
  installNativeRichChatInput(
    session,
    game,
    createBitmapClasses(portedClasses(session).resolve).resolve,
  );
  installNativeChatHistory(session, game);
  installCommandAutocomplete(session, game);
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

function installTargetPicking(game: Raw, session: API, ui: NativeUI, target: TargetSystem): void {
  const bindings = new Map<Raw, { clip: Raw; dispose: () => void }>();
  const canvas = game.canvas;
  const originalCanvasTouchable = read(canvas, 'touchable');

  canvas.set_touchable(true);
  session.defer(() => canvas.set_touchable(originalCanvasTouchable));
  session.defer(() => {
    for (const binding of bindings.values()) binding.dispose();
    bindings.clear();
  });

  session.interval(() => {
    const units: Raw[] = game.unitManager.units;
    const presentUnits = new Set(units);

    for (const [unit, binding] of bindings) {
      const clipChanged = read(unit, 'movieClip') !== binding.clip;
      if (!presentUnits.has(unit) || !unit.alive || clipChanged) {
        binding.dispose();
        bindings.delete(unit);
      }
    }

    for (const unit of units) {
      if (!target.valid(unit) || bindings.has(unit)) continue;

      const clip = read(unit, 'movieClip');
      if (!clip) continue;

      const originalTouchable = read(clip, 'touchable');
      clip.set_touchable(true);
      const removeListener = ui.touch(clip, () => target.select(unit));
      bindings.set(unit, {
        clip,
        dispose() {
          removeListener();
          clip.set_touchable(originalTouchable);
        },
      });
    }
  }, 250);
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
