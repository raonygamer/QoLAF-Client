import { read, type API, type Raw } from '../api/Types';
import { ChatArtifactChannelPolicy } from './ChatArtifactChannelPolicy';
import { ChatArtifactToken } from './rich/ChatArtifactToken';

export function permitsArtifactDraft(chat: Raw, text: string): boolean {
  if (!ChatArtifactToken.containsToken(text)) return true;
  const command = chat.parseCommand(text)[0];
  return ChatArtifactChannelPolicy.allows(ChatArtifactChannelPolicy.commandChannel(command));
}

/** Preserve the source's channel policy, including calls bypassing the composer. */
export function installNativeChatArtifactPolicy(api: API, game: Raw): void {
  const chat = game.chatInput;
  if (!chat?.input) return;
  const reject = () => {
    api
      .cls('core.hud.components.chat.MessageLog')
      ?.write(ChatArtifactChannelPolicy.restrictionMessage, 'error');
    return false;
  };

  api.around(chat, 'sendMessage', function (next, ...args) {
    if (!permitsArtifactDraft(this, read(this.input, 'text', ''))) return reject();
    return next(...args);
  });

  const destinations: Record<string, string> = {
    sendGlobal: 'global',
    sendGroup: 'group',
    sendPrivate: 'private',
    sendChatMessageMod: 'modchat',
    sendLocal: 'local',
  };
  for (const [method, destination] of Object.entries(destinations)) {
    if (typeof chat[method] !== 'function') continue;
    api.around(chat, method, function (next, text: string, ...args) {
      // Haxe routes Clan through sendLocal(body, "clan"). Private's second
      // argument is the recipient, so it must never be treated as a channel.
      const channel = method === 'sendLocal' ? (args[0] ?? destination) : destination;
      if (ChatArtifactToken.containsToken(text) && !ChatArtifactChannelPolicy.allows(channel))
        return reject();
      return next(text, ...args);
    });
  }
}
