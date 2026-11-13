import type { API } from '../api/Types';
import { MessageLog, type GameScene } from '../game/Bindings';
import type { ChatMessage } from '../game/ChatMessage';
import type { ChatArtifactLinkResolver } from './ChatArtifactLinkResolver';

/** Original eager history scan; unresolved or load-shed rows remain retryable. */
export function installChatArtifactHistory(
  api: API,
  game: GameScene,
  artifacts: Pick<ChatArtifactLinkResolver, 'resolveText'>,
): void {
  const log = game.messageLog;
  if (!log?.advanced) return;
  const scan = (message?: ChatMessage | null) => {
    if (!message || message.artifactLinksScanned) return;
    message.artifactLinksScanned = artifacts.resolveText(message.text);
  };
  const scanHistory = () => {
    const queue = MessageLog.textQueue;
    for (let index = queue.length - 1; index >= 0; index--) scan(queue[index]);
  };
  api.before(log, 'updateTexts', scan);
  log.advanced.addEventListener('addedToStage', scanHistory);
  api.defer(() => log.advanced.removeEventListener('addedToStage', scanHistory));
  if (log.contains(log.advanced)) scanHistory();
}
