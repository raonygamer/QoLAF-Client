import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, type GameScene } from '../game/Bindings';
import type { ChatMessage } from '../game/ChatMessage';
import { ChatArtifactToken } from './rich/ChatArtifactToken';

// Like the original MessageLog static: once per loaded client, across room changes.
let shown = false;

/** Append the original discoverability hint immediately after a new visible link. */
export function installChatArtifactHint(api: API, game: GameScene): void {
  const log = game.messageLog;
  if (!log) return;
  const observed = new WeakSet<ChatMessage>(MessageLog.textQueue);
  const reflection = new GameReflection(api);
  reflection.around(log, 'updateTexts', function (next, message) {
    const result = next(message);
    if (!message || observed.has(message)) return result;
    observed.add(message);
    const queue = MessageLog.textQueue;
    const channel = message.type || 'system';
    if (
      shown ||
      MessageLog.g !== game ||
      queue[queue.length - 1] !== message ||
      this.isMuted(channel) ||
      this.isMuted('system') ||
      !ChatArtifactToken.containsToken(message.text)
    )
      return result;
    shown = true;
    const tip: ChatMessage = {
      text: "<FONT COLOR='#8f8f8f'>Tip: Open chat and hover an artifact link to inspect its stats.</FONT>",
      type: 'system',
      timeout: game.time + 60000,
    };
    queue.push(tip);
    if (queue.length > MessageLog.extendedMaxLines) queue.splice(0, 1);
    observed.add(tip);
    // Bypass message parsing/sender snapshots, just as the original direct row insertion.
    next(tip);
    return result;
  });
}
