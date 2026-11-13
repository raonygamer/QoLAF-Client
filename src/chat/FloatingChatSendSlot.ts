import type { API } from '../api/Types';
import type { ChatInputText, GameScene, Player } from '../game/Bindings';

interface ChatSendClock extends Pick<ChatInputText, 'nextGlobalRdySendTime' | 'nextRdySendTime'> {
  g:
    | (Pick<GameScene, 'time'> & {
        get_me(): Pick<Player, 'isDeveloper' | 'isModerator'> | null;
      })
    | null;
  floatingContext?: object | null;
}

/** Share the native composer's exact clocks; another window gets no extra send slot. */
export function claimFloatingChatSendSlot(composer: ChatSendClock, channel: string): string | null {
  const game = composer.g;
  const player = game?.get_me();
  if (!game || !player || composer.floatingContext != null) return 'Chat is unavailable.';
  if (channel === 'global') {
    if (composer.nextGlobalRdySendTime > game.time && !player.isDeveloper && !player.isModerator)
      return `You have to wait ${Math.round((composer.nextGlobalRdySendTime - game.time) / 1000)} seconds.`;
    composer.nextGlobalRdySendTime = game.time + 30000;
  } else if (['local', 'clan', 'modchat'].includes(channel)) {
    if (composer.nextRdySendTime > game.time) return 'Hold your horses cowboy.';
    composer.nextRdySendTime = game.time + 1000;
  }
  return null;
}

export function installFloatingChatSendSlot(api: API, game: Pick<GameScene, 'chatInput'>): void {
  const composer = game.chatInput;
  if (!composer) return;
  const previous = Object.getOwnPropertyDescriptor(composer, 'claimFloatingChatSendSlot');
  composer.claimFloatingChatSendSlot = (channel: string) =>
    claimFloatingChatSendSlot(composer, channel);
  api.defer(() => {
    if (previous) Object.defineProperty(composer, 'claimFloatingChatSendSlot', previous);
    else delete composer.claimFloatingChatSendSlot;
  });
}
