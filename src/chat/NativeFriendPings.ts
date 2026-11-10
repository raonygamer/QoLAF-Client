import { read, type API, type Raw } from '../api/Types';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendPingFormatter } from './ChatFriendPingFormatter';
import { friendPingTargets, snapshotFriendPings } from './ChatFriendPingTargets';

/** Receive-side projection after native length/profanity/team checks, before native role styling. */
export function installNativeFriendPings(api: API, game: Raw, notify: () => void = () => {}): void {
  const MessageLog = api.cls('core.hud.components.chat.MessageLog');
  if (!MessageLog || !game.messageLog) return;
  let receiving:
    | {
        prefix: string;
        targets: ChatFriendPingData[];
        senderId: string | null;
        senderName: string | null;
        selfPing: boolean;
        delivered: boolean;
      }
    | undefined;
  api.around(MessageLog, 'writeChatMsg', function (next, ...args) {
    if (MessageLog.g !== game) return next(...args);
    const prior = receiving;
    const name = args[3];
    // Haxe prepends this exact supporter markup before calling colorRights.
    const supporter = args[5] ? "<font color='#ffff66'>&#9733;</font>" : '';
    receiving = {
      prefix: supporter + (name != null ? name + ': ' : ''),
      targets: friendPingTargets(api, game),
      senderId: args[2],
      senderName: name,
      selfPing: false,
      delivered: false,
    };
    try {
      const result = next(...args);
      if (receiving.selfPing && receiving.delivered) {
        try {
          notify();
        } catch {
          /* Chat delivery is independent of notification audio. */
        }
      }
      return result;
    } finally {
      receiving = prior;
    }
  });
  api.around(MessageLog, 'colorRights', function (next, rights, text) {
    if (receiving && typeof text === 'string' && text.startsWith(receiving.prefix)) {
      const body = text.slice(receiving.prefix.length);
      const me = read(game, 'me');
      const ownName = read(me, 'name', '');
      receiving.selfPing =
        !!receiving.senderName &&
        !!ownName &&
        receiving.senderId !== me?.id &&
        receiving.senderId !== game.client?.connectUserId &&
        receiving.senderName.toLowerCase() !== ownName.toLowerCase() &&
        ChatFriendPingFormatter.contains(body, ownName);
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
    if (receiving && message?.text) {
      message.pings = snapshotFriendPings(message.text, receiving.targets);
      receiving.delivered = true;
    }
    return next(message, ...args);
  });
}
