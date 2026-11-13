import type { API } from '../api/Types';
import type { GameScene } from '../game/Bindings';
import { sessionSettings } from '../settings/RuntimeSettings';
import { installInactivityPreference } from './Inactivity';

/** Install before asynchronous fonts or optional HUD setup can delay protection. */
export function installSessionProtection(api: API, game: GameScene) {
  const settings = sessionSettings(api, game);
  installInactivityPreference(api, game);
  return settings;
}
