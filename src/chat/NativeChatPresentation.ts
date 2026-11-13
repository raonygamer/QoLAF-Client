import { ChatProfanityFilter } from './ChatProfanityFilter';
import { TrustedMessengerPresentation } from './TrustedMessengerPresentation';
import { createChatRoleTags } from '../ported/ChatRoleTags';
import { isClientDeveloper } from '../visuals/ClientVisualAuthority';
import type { API } from '../api/Types';
import { MessageLog, type GameScene } from '../game/Bindings';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { ChatFriendPingFormatter } from './ChatFriendPingFormatter';
import { friendPingTargets, snapshotFriendPings } from './ChatFriendPingTargets';
import { clientEchoText } from './ClientEcho';
import { GameReflection } from '../api/GameReflection';
import { snapshotChatSender } from './ChatSenderSnapshot';

/** Original rich-text projection around native length, channel and team checks. */
export function installNativeChatPresentation(
  api: API,
  game: GameScene,
  notify: () => void = () => {},
): void {
  if (!game.messageLog) return;
  const reflection = new GameReflection(api);
  const clientDeveloperColor = 0xff6666;
  const Roles = createChatRoleTags(() => ({ COLOR_CLIENT_DEVELOPER: clientDeveloperColor }));
  const bypassDictionary = Object.freeze({});
  let dictionary: Record<string, unknown> | null = null;
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
  reflection.around(MessageLog, 'writeChatMsg', function (next, ...args) {
    if (MessageLog.g !== game || typeof args[1] !== 'string' || args[1].length > 250)
      return next(...args);
    // MessageLog.diff: respond before presentation/team filtering, only to an
    // exact echo request from someone else. Global requests receive a whisper.
    const me = game.get_me();
    if (
      args[1] === 'echo.' &&
      me != null &&
      args[2] != null &&
      args[3] != null &&
      me.id !== args[2]
    ) {
      if (args[0] === 'global' || args[0] === 'private')
        game.sendToServiceRoom('chatMsg', ['private', args[3], clientEchoText()]);
      else game.sendToServiceRoom('chatMsg', ['local', clientEchoText()]);
    }
    const nativeDictionary = MessageLog.profanities;
    if (nativeDictionary !== bypassDictionary && nativeDictionary !== dictionary) {
      dictionary = nativeDictionary;
      profanityFilter = new ChatProfanityFilter(dictionary);
    }
    const relay = TrustedMessengerPresentation.format(args[2] ?? null, args[1]);
    const prior = receiving;
    const name = args[3] ?? null;
    // Haxe prepends this exact supporter markup before calling colorRights.
    const nativeSupporter = args[5] ? "<font color='#ffff66'>&#9733;</font>" : '';
    // Project the original client's supporter glyph and separator after matching
    // the upstream prefix; its Haxe wire-to-text path still uses the older star.
    const supporter = args[5] ? "<font color='#ffff66'>&#11088;</font> " : '';
    const current: NonNullable<typeof receiving> = {
      prefix: nativeSupporter + (name != null ? name + ': ' : ''),
      senderPrefix: supporter + (name ? name + ': ' : ''),
      supporter,
      body: profanityFilter.apply(relay ?? args[1]),
      relay: relay !== null,
      announcement: relay !== null && args[1].startsWith('A:'),
      targets: friendPingTargets(api, game),
      senderId: args[2] ?? null,
      senderName: name,
      selfPing: false,
      delivered: false,
    };
    receiving = current;
    // Keep the original wire body for native length/team validation, but bypass
    // its raw-markup regex pass. The source filter above owns visible text.
    // Restore even on exceptions; nested chat calls reuse the saved dictionary.
    MessageLog.profanities = bypassDictionary;
    try {
      const result = next(...args);
      if (current.selfPing && current.delivered) {
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
  reflection.around(MessageLog, 'colorRights', function (next, rights, text) {
    if (receiving && typeof text === 'string' && text.startsWith(receiving.prefix)) {
      const body = receiving.body;
      const me = game.get_me();
      const ownName = me?.get_name() ?? '';
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
    reflection.around(MessageLog, 'colorCoding', function (next, text) {
      return receiving?.relay && text === '[global]' ? '' : next(text);
    });
  reflection.around(game.messageLog, 'updateTexts', function (next, message, ...args) {
    if (receiving && message?.text) {
      snapshotChatSender(
        game,
        message,
        receiving.senderId,
        receiving.senderName,
        receiving.relay,
        receiving.targets,
      );
      message.pings = snapshotFriendPings(message.text, receiving.targets);
      receiving.delivered = true;
    }
    return next(message, ...args);
  });
}
