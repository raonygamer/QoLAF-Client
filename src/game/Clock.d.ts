import './Game';

/** Source client lifetime method installed by installClockLifecycle. */
declare module './Game' {
  namespace Game.clock {
    interface Clock {
      dispose(): void;
    }
  }
}
