import { read, type API, type Raw } from '../Api/Types';
import { sessionSettings } from '../Settings/RuntimeSettings';
import { installNativeSettings } from '../Settings/NativeSettings';
import type { DeviceSettings } from '../Settings/DeviceSettings';
import type { Settings } from '../Settings/Settings';
import { TargetSystem } from '../Target/TargetSystem';
import { NativeUI } from '../UI/NativeUI';
import { loadTargetAimIndicator, type TargetAimIndicator } from '../UI/TargetAimIndicator';
import { TargetInfo } from '../UI/TargetInfo';
import { installHealthAndShield } from '../Hud/HealthAndShield';
import { installNativeChatPreferences } from '../Chat/NativeChatPreferences';
import { installClanLabels } from '../UI/ClanLabel';
import { installDamageText } from '../Hud/DamageText';
import { installRespawn } from './Respawn';
import { RadarTelemetry } from '../UI/RadarTelemetry';

/** Owns the native HUD nodes and hooks for one connected game session. */
export function installGameSession(
  game: Raw,
  session: API,
  preferences?: DeviceSettings,
  targetIcon?: string,
): void {
  const ui = new NativeUI(session);
  const { config, save } = sessionSettings(session, game);
  installNativeSettings(session, preferences);
  installHealthAndShield(session, game);
  installRespawn(session, game);
  installDamageText(session, game);
  installClanLabels(session, game);
  installNativeChatPreferences(session, game, preferences);
  const target = new TargetSystem(game, config, session.cls('core.ship.PlayerShip'));
  let indicator: TargetAimIndicator | undefined;
  if (targetIcon)
    loadTargetAimIndicator(ui, game, target, targetIcon, (value) => {
      indicator = value;
    });
  const panel = new TargetInfo(ui, game, target, config, save);
  session.defer(() => panel.dispose());
  const telemetry = new RadarTelemetry(ui, game, config);
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

  // As in the original client, radar candidates offer automatic targets.
  const radar = session.cls('core.hud.components.radar.Radar')?.prototype;
  if (typeof radar?.update === 'function') {
    session.after(radar, 'update', function () {
      for (const unit of game.unitManager.units) {
        if (unit.isHostile) target.auto(unit);
      }
    });
  }
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
