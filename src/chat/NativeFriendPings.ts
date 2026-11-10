import type { API, Raw } from '../api/Types';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendPingFormatter } from './ChatFriendPingFormatter';
import { friendPingTargets, snapshotFriendPings } from './ChatFriendPingTargets';

/** Receive-side projection after native length/profanity/team checks, before native role styling. */
export function installNativeFriendPings(api: API, game: Raw): void {
  const MessageLog = api.cls('core.hud.components.chat.MessageLog');
  if (!MessageLog || !game.messageLog) return;
  let receiving: { prefix: string; targets: ChatFriendPingData[] } | undefined;
  api.around(MessageLog, 'writeChatMsg', function (next, ...args) {
    if (MessageLog.g !== game) return next(...args);
    const prior = receiving;
    const name = args[3];
    // Haxe prepends this exact supporter markup before calling colorRights.
    const supporter = args[5] ? "<font color='#ffff66'>&#9733;</font>" : '';
    receiving = {
      prefix: supporter + (name != null ? name + ': ' : ''),
      targets: friendPingTargets(api, game),
    };
    try {
      return next(...args);
    } finally {
      receiving = prior;
    }
  });
  api.around(MessageLog, 'colorRights', function (next, rights, text) {
    if (receiving && typeof text === 'string' && text.startsWith(receiving.prefix)) {
      const body = text.slice(receiving.prefix.length);
      text =
        receiving.prefix +
        ChatFriendPingFormatter.format(
          body,
          receiving.targets.map((target) => target.name),
        );
    }
    return next(rights, text);
  });
  api.around(game.messageLog, 'updateTexts', function (next, message, ...args) {
    if (receiving && message?.text)
      message.pings = snapshotFriendPings(message.text, receiving.targets);
    return next(message, ...args);
  });
}
