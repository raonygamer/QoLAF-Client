import { GameReflection } from '../api/GameReflection';
import type { API } from '../api/Types';
import { MessageLog } from '../game/Bindings';
import type { FormattedChatMessage } from './FormattedChatMessage';
import { createChatRoleTags } from '../ported/ChatRoleTags';
import { isClientDeveloper } from '../visuals/ClientVisualAuthority';
import { ChatProfanityFilter } from './ChatProfanityFilter';
import { ChatFriendPingFormatter } from './ChatFriendPingFormatter';
import { friendPingTargets, snapshotFriendPings } from './ChatFriendPingTargets';
import { TrustedMessengerPresentation } from './TrustedMessengerPresentation';

/** MessageLog.formatFloatingChatRow without writeChatMsg's primary-room side effects. */
export function createFloatingChatFormatter(api: API, game: object) {
  const reflection = new GameReflection(api);
  const log = MessageLog;
  const roles = createChatRoleTags(() => ({ COLOR_CLIENT_DEVELOPER: 0xff6666 }));
  let dictionary: Record<string, unknown> | null = null;
  let profanity = new ChatProfanityFilter(null);
  return (
    channel: string,
    body: string,
    senderId: string,
    senderName: string,
    rights: string,
    supporter: boolean,
  ): FormattedChatMessage | null => {
    if (body == null || body.length > 250) return null;
    if (dictionary !== log.profanities) {
      dictionary = log.profanities;
      profanity = new ChatProfanityFilter(dictionary);
    }
    const relay = TrustedMessengerPresentation.format(senderId, body);
    const announcement = relay !== null && body.startsWith('A:');
    let text = profanity.apply(relay ?? body);
    const targets = friendPingTargets(api, reflection.cast(game, 'core.scene.Game'));
    if (text.includes('@'))
      text = ChatFriendPingFormatter.format(
        text,
        targets.map((target) => target.name),
        announcement
          ? TrustedMessengerPresentation.announcementColor
          : ChatFriendPingFormatter.PING_COLOR,
      );
    if (relay === null && senderName) {
      const escaped = senderName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      text = escaped + ': ' + text;
    }
    if (supporter) text = "<font color='#ffff66'>&#11088;</font> " + text;
    if (isClientDeveloper(senderId) && rights === '') rights = 'client_dev';
    if (relay === null && senderName) text = roles.prependPlayerTags(senderId, text);
    text = log.colorRights(rights, text);
    if (channel !== 'global' || relay === null)
      text = log.colorCoding('[' + channel + ']') + ' ' + text;
    return {
      type: channel,
      text,
      playerKey: senderId,
      playerId: senderId,
      playerName: senderName,
      supporter,
      pings: snapshotFriendPings(text, targets),
    };
  };
}
