import type { ArtifactOverview, GameScene } from '../game/Bindings';
import type { ArtifactLayout } from './ArtifactLayout';

/** Client-owned inventory state layered on the native game and overview. */
export interface ArtifactGame extends GameScene {
  artifactRecyclePending?: boolean;
}

export interface ArtifactView extends ArtifactOverview, Partial<ArtifactLayout> {
  g: ArtifactGame;
  artifactViewDisposed?: boolean;
  artifactMenu?: { close(): void };
}
