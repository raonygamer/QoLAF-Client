import './Game';

declare module './Game' {
  namespace Game.core.scene {
    interface Game {
      get_initialWorldIsRevealed(): boolean;
      tryRevealInitialWorld(): void;
    }
  }
}
