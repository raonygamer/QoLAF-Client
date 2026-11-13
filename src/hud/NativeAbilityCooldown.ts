import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene } from '../game/Bindings';

/** Keep the boost button covered until the delayed movement clock is ready. */
export function installNativeAbilityCooldown(api: API, game: GameScene): void {
  const abilities = game.hud?.abilities;
  if (!abilities) return;
  const originals = new WeakMap<object, number>();
  const padding = 2 * GameScene.TICK_LENGTH;
  const apply = () => {
    for (const hotkey of abilities.hotkeys) {
      if (hotkey.obj?.name !== 'Engine' || originals.has(hotkey)) continue;
      const duration = hotkey._cooldownTime;
      originals.set(hotkey, duration);
      hotkey.set_cooldownTime(duration + padding);
    }
  };
  new GameReflection(api).after(abilities, 'load', apply);
  api.defer(() => {
    for (const hotkey of abilities.hotkeys) {
      const original = originals.get(hotkey);
      if (original !== undefined && hotkey._cooldownTime === original + padding)
        hotkey.set_cooldownTime(original);
    }
  });
  apply();
}
