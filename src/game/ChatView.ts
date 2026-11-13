import type {} from './Game';

declare module './Game' {
  namespace Game.core.hud.components.chat {
    interface ChatSimple {
      clearMessages?(): void;
    }
  }
}
