import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, PlayerManager } from '../game/Bindings';

/** Original PlayerManager's ID-specific Argon spelling, only in its warp notice. */
export function installWarpAnnouncement(api: API): void {
  let sereneWarp = false;
  const reflection = new GameReflection(api);
  reflection.around(PlayerManager.prototype, 'initWarpJump', function (next, message) {
    const previous = sereneWarp;
    sereneWarp = message.length > 0 && message.getString(0) === 'kong4106679';
    try {
      return next(message);
    } finally {
      sereneWarp = previous;
    }
  });
  reflection.around(MessageLog, 'writeChatMsg', function (next, channel, text, ...args) {
    if (sereneWarp && channel === 'join_leave' && text.endsWith(' warp jumped to Argon'))
      text = text.slice(0, -5) + 'Argoon';
    return next(channel, text, ...args);
  });
}
