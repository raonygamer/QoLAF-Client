import type { Game } from './Game';

declare module './Game' {
  namespace Game.core.artifact {
    interface ArtifactOverview {
      artifactViewDisposed?: boolean;
      expandedView?: boolean;
      viewHeight?: number;
      infoX?: number;
      lineInput: Game.core.hud.components.InputText;
      fitnessInput: Game.core.hud.components.InputText;
      strengthInput: Game.core.hud.components.InputText;
      purifyButton: Game.core.hud.components.Button;
      saveStatsButton: Game.core.hud.components.Button;
      updateInventorySummary?(): void;
    }
  }
  namespace Game.core.scene {
    interface Game {
      artifactRecyclePending?: boolean;
    }
  }
}
