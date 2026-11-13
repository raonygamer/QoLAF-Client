import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayerManager } from '../game/Bindings';

/** Source PlayerManager guards for messages arriving outside a ship's lifetime. */
export function installPlayerMessageGuards(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(PlayerManager.prototype, 'setSpeed', function (next, message) {
    const player = this.get_playersById().h[message.getString(0)];
    if (!player?.ship?.engine) return;
    return next(message);
  });
  reflection.around(PlayerManager.prototype, 'landFailed', function (next, message) {
    const id = message.getString(0);
    if (!this.get_playersById().h[id]?.ship) {
      api.log('Ignored land failure for shipless player:', id);
      return;
    }
    return next(message);
  });
}
