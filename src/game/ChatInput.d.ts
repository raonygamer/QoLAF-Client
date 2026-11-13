import './Game';

/** Optional extension installed by the client's shared chat send limiter. */
declare module './Game' {
  namespace Game.core.hud.components.chat {
    interface ChatInputText {
      claimFloatingChatSendSlot?(channel: string): string | null;
    }
  }
}
