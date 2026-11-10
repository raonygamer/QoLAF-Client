import { ChatProfanityFilter } from './ChatProfanityFilter';
import { TrustedMessengerPresentation } from './TrustedMessengerPresentation';
import { createChatRoleTags } from '../ported/ChatRoleTags';
import { isClientDeveloper } from '../visuals/ClientVisualAuthority';
import { read, type API, type Raw } from '../api/Types';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendPingFormatter } from './ChatFriendPingFormatter';
import { friendPingTargets, snapshotFriendPings } from './ChatFriendPingTargets';

/** Original rich-text projection around native length, channel and team checks. */
export function installNativeChatPresentation(
  api: API,
  game: Raw,
  notify: () => void = () => {},
): void {
  const MessageLog = api.cls('core.hud.components.chat.MessageLog');
  if (!MessageLog || !game.messageLog) return;
  const clientDeveloperColor = 0xff6666;
  const Roles = createChatRoleTags(() => ({ COLOR_CLIENT_DEVELOPER: clientDeveloperColor }));
  const bypassDictionary = Object.freeze({});
  let dictionary: Raw | null = null;
  let profanityFilter = new ChatProfanityFilter(null);
  let receiving:
    | {
        prefix: string;
        senderPrefix: string;
        supporter: string;
        body: string;
        relay: boolean;
        announcement: boolean;
        targets: ChatFriendPingData[];
        senderId: string | null;
        senderName: string | null;
        selfPing: boolean;
        delivered: boolean;
      }
    | undefined;
  api.around(MessageLog, 'writeChatMsg', function (next, ...args) {
    if (MessageLog.g !== game || typeof args[1] !== 'string' || args[1].length > 250)
      return next(...args);
    const nativeDictionary = MessageLog.profanities;
    if (nativeDictionary !== bypassDictionary && nativeDictionary !== dictionary) {
      dictionary = nativeDictionary;
      profanityFilter = new ChatProfanityFilter(dictionary);
    }
    const relay = TrustedMessengerPresentation.format(args[2], args[1]);
    const prior = receiving;
    const name = args[3];
    // Haxe prepends this exact supporter markup before calling colorRights.
    const supporter = args[5] ? "<font color='#ffff66'>&#9733;</font>" : '';
    receiving = {
      prefix: supporter + (name != null ? name + ': ' : ''),
      senderPrefix: supporter + (name ? name + ': ' : ''),
      supporter,
      body: profanityFilter.apply(relay ?? args[1]),
      relay: relay !== null,
      announcement: relay !== null && args[1].startsWith('A:'),
      targets: friendPingTargets(api, game),
      senderId: args[2],
      senderName: name,
      selfPing: false,
      delivered: false,
    };
    // Keep the original wire body for native length/team validation, but bypass
    // its raw-markup regex pass. The source filter above owns visible text.
    // Restore even on exceptions; nested chat calls reuse the saved dictionary.
    MessageLog.profanities = bypassDictionary;
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
      MessageLog.profanities = nativeDictionary;
      receiving = prior;
    }
  });
  api.around(MessageLog, 'colorRights', function (next, rights, text) {
    if (receiving && typeof text === 'string' && text.startsWith(receiving.prefix)) {
      const body = receiving.body;
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
        (receiving.relay ? receiving.supporter : receiving.senderPrefix) +
        ChatFriendPingFormatter.format(
          body,
          receiving.targets.map((target) => target.name),
          receiving.announcement
            ? TrustedMessengerPresentation.announcementColor
            : ChatFriendPingFormatter.PING_COLOR,
        );
      if (!receiving.relay && receiving.senderName)
        text = Roles.prependPlayerTags(receiving.senderId, text);
      if (!rights && isClientDeveloper(receiving.senderId)) rights = 'client_dev';
    }
    if (rights === 'client_dev')
      return "<FONT COLOR='#" + clientDeveloperColor.toString(16) + "'>[client_dev]</FONT> " + text;
    return next(rights, text);
  });
  if (typeof MessageLog.colorCoding === 'function')
    api.around(MessageLog, 'colorCoding', function (next, text) {
      return receiving?.relay && text === '[global]' ? '' : next(text);
    });
  api.around(game.messageLog, 'updateTexts', function (next, message, ...args) {
    if (receiving && message?.text) {
      if (receiving.relay) message.playerId = receiving.senderId;
      message.pings = snapshotFriendPings(message.text, receiving.targets);
      receiving.delivered = true;
    }
    return next(message, ...args);
  });
}
