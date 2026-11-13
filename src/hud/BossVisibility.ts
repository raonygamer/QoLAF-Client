import type { API } from '../api/Types';
import type { GameScene } from '../game/Bindings';
import type { Settings } from '../settings/Settings';

export function installBossVisibility(
  game: GameScene,
  session: API,
  config: Pick<Settings, 'disable_native_boss_bar'>,
): () => void {
  const bossBar = game.hud?.bossHealth;
  if (!bossBar) return () => {};
  const setVisibility = bossBar.set_visible;
  let nativeVisibility = bossBar.get_visible();

  // Remember what the game wants, even while the client hides its boss bar.
  // Disabling the override restores that value rather than forcing it visible.
  session.defer(() => setVisibility.call(bossBar, nativeVisibility));
  session.around(bossBar, 'set_visible', function (next, value) {
    nativeVisibility = value;
    return next(config.disable_native_boss_bar ? false : value);
  });

  return () => {
    setVisibility.call(bossBar, config.disable_native_boss_bar ? false : nativeVisibility);
  };
}
