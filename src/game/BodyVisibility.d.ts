import './Game';

declare module './Game' {
  namespace Game.core.solarSystem {
    interface Body {
      lastViewSizeRevision?: number;
    }
  }
}
