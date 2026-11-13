import type { Game } from './Game';

declare module './Game' {
  namespace Game.core.hud.components.techTree {
    interface TechLevelIcon {
      readonly techBar: TechBar;
      get_techBar(): TechBar;
    }
  }
}
