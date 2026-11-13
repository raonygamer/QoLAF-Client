import './Game';

/** Original client recovery state, backed by the port's owned reconnect attempt. */
declare module './Game' {
  namespace Game.core.scene {
    interface Game {
      readonly isRecoveringGameConnection: boolean;
      get_isRecoveringGameConnection(): boolean;
    }
  }
}
